import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { Prisma } from '@prisma/client';
import { prisma } from './db';

const execFileAsync = promisify(execFile);

function getPythonPath(): string {
  return process.env.PYTHON_PATH || 'python';
}

function getCliScriptPath(): string {
  return path.join(process.cwd(), 'worker', 'face_cli.py');
}

export function chunkArray<T>(items: T[], size = 500): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export interface DetectedFace {
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  embedding: number[];
  thumbnailFilename: string;
}

export interface ClusterGroup {
  clusterIndex: number;
  faceIds: string[];
  representativeFaceId: string;
}

export interface ClusterResult {
  clusters: ClusterGroup[];
  noiseFaceIds: string[];
}

export interface BatchDetectionOutput {
  scannedCount: number;
  totalDetected: number;
  results: Record<string, { faces?: DetectedFace[]; error?: string }>;
  successfulPhotoIds: string[];
  allDetectedFaces: Array<{
    id: string;
    photoId: string;
    boundingBox: any;
    embedding: number[];
    confidence: number;
    thumbnailUrl: string;
    isNoise: boolean;
  }>;
}

/**
 * Run face detection and feature extraction on a single photo
 */
export async function scanPhotoForFaces(
  photoId: string,
  storageKeyOriginal: string
): Promise<{ detectedCount: number; faces: DetectedFace[] }> {
  const pythonPath = getPythonPath();
  const scriptPath = getCliScriptPath();

  const imageFullPath = path.resolve(process.cwd(), 'storage', storageKeyOriginal);
  const facesOutputDir = path.resolve(process.cwd(), 'storage', 'faces');

  try {
    const { stdout, stderr } = await execFileAsync(
      /*turbopackIgnore: true*/ pythonPath,
      [
        scriptPath,
        'detect',
        '--image',
        imageFullPath,
        '--outputDir',
        facesOutputDir,
        '--photoId',
        photoId,
      ],
      { maxBuffer: 10 * 1024 * 1024 }
    );

    if (stderr && stderr.includes('Error')) {
      console.warn('[FaceService detect warning]:', stderr);
    }

    const res = JSON.parse(stdout.trim());
    if (!res.success) {
      throw new Error(res.error || 'Face detection returned unsuccessful');
    }

    const detectedFaces: DetectedFace[] = res.faces || [];

    // Delete any old face records for this photo before inserting new ones
    await prisma.face.deleteMany({
      where: { photoId },
    });

    if (detectedFaces.length > 0) {
      await prisma.face.createMany({
        data: detectedFaces.map((f) => ({
          photoId,
          boundingBox: f.boundingBox,
          embedding: f.embedding,
          confidence: f.confidence,
          thumbnailUrl: `/api/faces/${f.thumbnailFilename}`,
          isNoise: false,
        })),
      });
    }

    return { detectedCount: detectedFaces.length, faces: detectedFaces };
  } catch (err: unknown) {
    console.error(`[FaceService scanPhotoForFaces failed for photo ${photoId}]:`, err);
    throw err;
  }
}

/**
 * Run face detection on multiple photos in a single persistent model session (outside of any DB transaction)
 */
export async function runBatchFaceDetection(
  photos: { id: string; storageKeyOriginal: string }[]
): Promise<BatchDetectionOutput> {
  if (photos.length === 0) {
    return {
      totalDetected: 0,
      scannedCount: 0,
      results: {},
      successfulPhotoIds: [],
      allDetectedFaces: [],
    };
  }

  const pythonPath = getPythonPath();
  const scriptPath = getCliScriptPath();
  const facesOutputDir = path.resolve(process.cwd(), 'storage', 'faces');

  const items = photos.map((p) => ({
    photoId: p.id,
    imagePath: path.resolve(process.cwd(), 'storage', p.storageKeyOriginal),
  }));

  const child = execFile(
    /*turbopackIgnore: true*/ pythonPath,
    [scriptPath, 'batch-detect', '--outputDir', facesOutputDir],
    { maxBuffer: 50 * 1024 * 1024 }
  );

  let stdout = '';
  let stderr = '';

  child.stdout?.on('data', (d) => {
    stdout += d;
  });
  child.stderr?.on('data', (d) => {
    stderr += d;
  });

  child.stdin?.write(JSON.stringify(items));
  child.stdin?.end();

  await new Promise<void>((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Batch face detection exited with code ${code}: ${stderr}`));
    });
    child.on('error', reject);
  });

  const parsed = JSON.parse(stdout.trim());
  if (!parsed.success) {
    throw new Error(parsed.error || 'Batch face detection returned unsuccessful');
  }

  const results: Record<string, { faces?: DetectedFace[]; error?: string }> = parsed.results || {};
  const successfulPhotoIds: string[] = [];
  const allDetectedFaces: BatchDetectionOutput['allDetectedFaces'] = [];
  let totalDetected = 0;

  for (const [photoId, res] of Object.entries(results)) {
    // Only count as successful if there is no error AND faces is defined
    if (res.error || res.faces === undefined) continue;
    successfulPhotoIds.push(photoId);
    const faces = res.faces;
    totalDetected += faces.length;
    for (const f of faces) {
      allDetectedFaces.push({
        id: crypto.randomUUID(),
        photoId,
        boundingBox: f.boundingBox,
        embedding: f.embedding,
        confidence: f.confidence,
        thumbnailUrl: `/api/faces/${f.thumbnailFilename}`,
        isNoise: false,
      });
    }
  }

  return {
    scannedCount: photos.length,
    totalDetected,
    results,
    successfulPhotoIds,
    allDetectedFaces,
  };
}

/**
 * Run clustering on face embeddings outside of any DB transaction
 */
export async function runPythonClustering(
  faces: Array<{ id: string; embedding: number[]; confidence: number; thumbnailUrl?: string | null }>,
  options?: { eps?: number; minSamples?: number }
): Promise<ClusterResult> {
  if (faces.length === 0) {
    return { clusters: [], noiseFaceIds: [] };
  }

  const pythonPath = getPythonPath();
  const scriptPath = getCliScriptPath();
  const eps = options?.eps ?? 0.50;
  const minSamples = options?.minSamples ?? 2;

  const inputFaces = faces.map((f) => ({
    id: f.id,
    embedding: f.embedding,
    confidence: f.confidence,
  }));

  const child = execFile(
    /*turbopackIgnore: true*/ pythonPath,
    [scriptPath, 'cluster', '--eps', String(eps), '--minSamples', String(minSamples)],
    { maxBuffer: 20 * 1024 * 1024 }
  );

  let stdout = '';
  let stderr = '';

  child.stdout?.on('data', (d) => {
    stdout += d;
  });
  child.stderr?.on('data', (d) => {
    stderr += d;
  });

  child.stdin?.write(JSON.stringify(inputFaces));
  child.stdin?.end();

  await new Promise<void>((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Clustering exited with code ${code}: ${stderr}`));
    });
    child.on('error', reject);
  });

  const parsed = JSON.parse(stdout.trim());
  if (!parsed.success) {
    throw new Error(parsed.error || 'Clustering returned unsuccessful');
  }

  return parsed.result;
}

/**
 * Atomically persist deletes, face inserts, person creates, face assignments, and thumbnail updates in one transaction.
 */
export async function persistScanAndClusterTransaction(params: {
  eventId: string;
  successfulPhotoIds: string[];
  allDetectedFaces: BatchDetectionOutput['allDetectedFaces'];
  clusterResult: ClusterResult;
  existingPeople: Array<{ id: string; name: string | null; thumbnailUrl: string | null; faces: Array<{ id: string }> }>;
  allFacesMap: Map<string, { id: string; thumbnailUrl?: string | null }>;
}): Promise<void> {
  const { eventId, successfulPhotoIds, allDetectedFaces, clusterResult, existingPeople, allFacesMap } = params;

  const newPeopleToCreate: Array<{
    id: string;
    eventId: string;
    name: string;
    thumbnailUrl: string | null;
    isCover: boolean;
  }> = [];

  const personThumbUpdates: Array<{ personId: string; thumbnailUrl: string }> = [];
  const assignments: Array<{ faceId: string; personId: string | null; isNoise: boolean }> = [];
  let peopleCount = existingPeople.length;

  for (let i = 0; i < clusterResult.clusters.length; i++) {
    const cluster = clusterResult.clusters[i];
    const repFace = allFacesMap.get(cluster.representativeFaceId);
    const thumbUrl = repFace?.thumbnailUrl || null;

    const existingMatch = existingPeople.find((p) =>
      p.faces.some((pf) => cluster.faceIds.includes(pf.id))
    );

    let personId: string;
    if (existingMatch) {
      personId = existingMatch.id;
      if (!existingMatch.thumbnailUrl && thumbUrl) {
        personThumbUpdates.push({ personId, thumbnailUrl: thumbUrl });
      }
    } else {
      peopleCount += 1;
      personId = crypto.randomUUID();
      newPeopleToCreate.push({
        id: personId,
        eventId,
        name: `Person ${peopleCount}`,
        thumbnailUrl: thumbUrl,
        isCover: i === 0,
      });
    }

    for (const fId of cluster.faceIds) {
      assignments.push({ faceId: fId, personId, isNoise: false });
    }
  }

  for (const noiseId of clusterResult.noiseFaceIds) {
    assignments.push({ faceId: noiseId, personId: null, isNoise: true });
  }

  const faceChunks = chunkArray(allDetectedFaces, 150);
  const peopleChunks = chunkArray(newPeopleToCreate, 500);
  const assignmentChunks = chunkArray(assignments, 500);

  await prisma.$transaction(
    async (tx) => {
      // 1. Delete old faces for successfully scanned photos
      if (successfulPhotoIds.length > 0) {
        await tx.face.deleteMany({
          where: { photoId: { in: successfulPhotoIds } },
        });
      }

      // 2. Insert new faces in chunks of 150
      for (const chunk of faceChunks) {
        await tx.face.createMany({
          data: chunk.map((f) => ({
            id: f.id,
            photoId: f.photoId,
            boundingBox: f.boundingBox,
            embedding: f.embedding,
            confidence: f.confidence,
            thumbnailUrl: f.thumbnailUrl,
            isNoise: false,
          })),
        });
      }

      // 3. Create new people in chunks of 500
      for (const chunk of peopleChunks) {
        await tx.person.createMany({ data: chunk });
      }

      // 4. Update face assignments in chunks of 500 with explicit SQL parameter casts
      for (const chunk of assignmentChunks) {
        const values = chunk.map(
          (r) => Prisma.sql`(${r.faceId}::text, ${r.personId}::text, ${r.isNoise}::boolean)`
        );
        await tx.$executeRaw`
          UPDATE "Face" AS f
          SET "personId" = v.person_id,
              "isNoise" = v.is_noise
          FROM (VALUES ${Prisma.join(values)}) AS v(face_id, person_id, is_noise)
          WHERE f.id = v.face_id
        `;
      }

      // 5. Update person thumbnails in one batched SQL statement
      if (personThumbUpdates.length > 0) {
        const thumbValues = personThumbUpdates.map(
          (u) => Prisma.sql`(${u.personId}::text, ${u.thumbnailUrl}::text)`
        );
        await tx.$executeRaw`
          UPDATE "Person" AS p
          SET "thumbnailUrl" = v.thumb_url
          FROM (VALUES ${Prisma.join(thumbValues)}) AS v(person_id, thumb_url)
          WHERE p.id = v.person_id
        `;
      }

      // 6. Clean up any empty Person entities
      await tx.person.deleteMany({
        where: {
          eventId,
          faces: { none: {} },
        },
      });
    },
    { maxWait: 60000, timeout: 60000 }
  );
}
