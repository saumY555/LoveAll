import sys
import os
import json
import argparse
from face_engine import FaceEngine

def main():
    parser = argparse.ArgumentParser(description="Face recognition and clustering engine CLI")
    subparsers = parser.add_subparsers(dest="command")

    # Command: detect (single photo)
    detect_parser = subparsers.add_parser("detect")
    detect_parser.add_argument("--image", required=True, help="Path to input image")
    detect_parser.add_argument("--outputDir", required=True, help="Directory to save face crops")
    detect_parser.add_argument("--photoId", default="", help="Photo identifier")
    detect_parser.add_argument("--conf", type=float, default=0.65, help="Confidence threshold")
    detect_parser.add_argument("--threads", type=int, default=None, help="ONNX intra_op_num_threads")

    # Command: batch-detect (multiple photos in one model session)
    batch_parser = subparsers.add_parser("batch-detect")
    batch_parser.add_argument("--inputFile", help="Path to JSON file containing list of photos")
    batch_parser.add_argument("--outputDir", required=True, help="Directory to save face crops")
    batch_parser.add_argument("--conf", type=float, default=0.65, help="Confidence threshold")
    batch_parser.add_argument("--threads", type=int, default=None, help="ONNX intra_op_num_threads")

    # Command: cluster
    cluster_parser = subparsers.add_parser("cluster")
    cluster_parser.add_argument("--inputFile", help="Path to JSON file containing face embeddings")
    cluster_parser.add_argument("--eps", type=float, default=0.50, help="Cosine distance threshold (default: 0.50)")
    cluster_parser.add_argument("--minSamples", type=int, default=2, help="Minimum cluster size")

    # Command: worker (interactive line-by-line daemon: model loaded ONCE)
    worker_parser = subparsers.add_parser("worker")
    worker_parser.add_argument("--outputDir", required=True, help="Directory to save face crops")
    worker_parser.add_argument("--conf", type=float, default=0.65, help="Confidence threshold")
    worker_parser.add_argument("--threads", type=int, default=None, help="ONNX intra_op_num_threads")

    args = parser.parse_args()

    if args.command == "detect":
        try:
            engine = FaceEngine(model_name="buffalo_l", det_size=(640, 640), intra_threads=args.threads)
            faces = engine.detect_and_embed(
                image_path=args.image,
                output_faces_dir=args.outputDir,
                conf_threshold=args.conf,
                photo_id=args.photoId,
                min_face_size=45
            )
            print(json.dumps({"success": True, "faces": faces}))
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e)}))
            sys.exit(1)

    elif args.command == "batch-detect":
        try:
            if args.inputFile and os.path.exists(args.inputFile):
                with open(args.inputFile, "r", encoding="utf-8") as f:
                    items = json.load(f)
            else:
                items = json.loads(sys.stdin.read())

            engine = FaceEngine(model_name="buffalo_l", det_size=(640, 640), intra_threads=args.threads)
            results = engine.detect_and_embed_batch(
                items=items,
                output_faces_dir=args.outputDir,
                conf_threshold=args.conf,
                min_face_size=45
            )
            print(json.dumps({"success": True, "results": results}))
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e)}))
            sys.exit(1)

    elif args.command == "cluster":
        try:
            if args.inputFile and os.path.exists(args.inputFile):
                with open(args.inputFile, "r", encoding="utf-8") as f:
                    faces_data = json.load(f)
            else:
                faces_data = json.loads(sys.stdin.read())

            result = FaceEngine.cluster_faces(
                faces_data=faces_data,
                eps=args.eps,
                min_samples=args.minSamples
            )
            print(json.dumps({"success": True, "result": result}))
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e)}))
            sys.exit(1)

    elif args.command == "worker":
        try:
            engine = FaceEngine(model_name="buffalo_l", det_size=(640, 640), intra_threads=args.threads)
            sys.stderr.write("[FaceWorker Python] Initialized and ready.\n")
            sys.stderr.flush()

            for line in sys.stdin:
                line = line.strip().lstrip('\ufeff')
                if not line:
                    continue
                if line == "PING":
                    sys.stdout.write(json.dumps({"pong": True}) + "\n")
                    sys.stdout.flush()
                    continue
                if line == "QUIT":
                    break
                task = {}
                try:
                    task = json.loads(line)
                    action = task.get("action", "detect")
                    if action == "detect":
                        faces = engine.detect_and_embed(
                            image_path=task["imagePath"],
                            output_faces_dir=args.outputDir,
                            conf_threshold=task.get("conf", args.conf),
                            photo_id=task.get("photoId", ""),
                            min_face_size=task.get("minFaceSize", 45)
                        )
                        sys.stdout.write(json.dumps({"success": True, "photoId": task.get("photoId", ""), "faces": faces}) + "\n")
                    elif action == "cluster":
                        result = FaceEngine.cluster_faces(
                            faces_data=task["faces"],
                            eps=task.get("eps", 0.50),
                            min_samples=task.get("minSamples", 2)
                        )
                        sys.stdout.write(json.dumps({"success": True, "result": result}) + "\n")
                    else:
                        sys.stdout.write(json.dumps({"success": False, "photoId": task.get("photoId", ""), "error": f"Unknown action: {action}"}) + "\n")
                except Exception as e:
                    sys.stdout.write(json.dumps({"success": False, "photoId": task.get("photoId", ""), "error": str(e)}) + "\n")
                sys.stdout.flush()
        except Exception as e:
            sys.stderr.write(f"[FaceWorker Python Error] {e}\n")
            sys.stderr.flush()
            sys.exit(1)

    else:
        parser.print_help()
        sys.exit(1)

if __name__ == "__main__":
    main()
