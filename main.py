#!/usr/bin/env python3
"""Run TurboDocs straight from the source tree: python main.py [file.docx]"""
import sys

from turbodocs.app import main

if __name__ == "__main__":
    sys.exit(main())
