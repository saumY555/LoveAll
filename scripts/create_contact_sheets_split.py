import { prisma } from '../src/lib/db';
import path from 'path';
import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';

// We can use Python with PIL / OpenCV or node to build contact sheets.
// Let's write a python script to generate the contact sheets cleanly with annotations.
