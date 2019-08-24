'use strict';

const pythonBridge = require('python-bridge');

const python = pythonBridge();

python.ex`
import cv2
from scene_text import AllWordsRecognizer
pipeline = AllWordsRecognizer()

def find_words(image_path):
  img = cv2.imread(image_path)[:, :, ::-1]
  words, boxes = pipeline.get_all_words(img)
  if boxes is None:
    return [[], []]
  else:
    # returning list, since JS functions can't return tuples
    return [words, boxes.astype(int).tolist()]

`;

// process.on('exit', () => python.end());

exports.find_words = (image_path) => python`find_words(${image_path})`;
