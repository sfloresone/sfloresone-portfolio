---
title: "A-Maze-Ing"
date: 2026-04-26
category: Dev
author: Sergio Flores
description: "A Python library to generate and solve perfect and imperfect mazes using backtracking and BFS pathfinding — a 42 curriculum project."
tags: [python, algorithms, "42", data-structures]
---

*This project has been created as part of the 42 curriculum by **sfloresone** and **Pabloms63**.*

## Description

**A-Maze-Ing** is a Python library designed to generate and solve both perfect and imperfect mazes using backtracking and search algorithms. A perfect maze is defined as one containing exactly one unique path between the entry and exit; imperfect mazes relax that constraint when you need something less strict.

The work is split into clear responsibilities instead of a single script that does everything. Generation builds the grid, pathfinding resolves it, the visualizer renders it, and file handling takes care of config and export — each part stays on its own.

This project demonstrates a modular architecture of:
- Maze Generation: with an extra feature (injection of a custom "42" pattern).
- Pathfinding: BFS (Breadth-First Search).
- Visualizer: Using ANSI and Unicode characters.
- File Handling: Exporting the results to files and parsing configuration inputs.

Backtracking drives maze generation; once the maze exists, BFS finds the shortest route from entry to exit.

## Characteristics

- **Modular generator**: Creates mazes of any size with configurable entry and exit points — you define the bounds and where the walk starts and ends.
- **42 logo integration**: Injects a custom "42" pattern if there is enough space (minimum 11×9 cells).
- **BFS**: Finds the shortest path between entry and exit after generation.
- **Interactive Menu**: Shows/Hides path, colour changing, regenerates maze — handy for trying different layouts without re-running from scratch.
- **Export System**: Saves the maze in a *.txt* file, including the solution path, so results survive beyond the terminal session.

## Installation

### Prerequisites
- Python 3.10+
- pip

> [!WARNING]
> **Important:** I **strongly** recommend using virtual environments to avoid *Makefile* errors or *permission* errors.

### Don't know how to create one? Don't worry...

Follow this steps in order to create one, it's very easy:

- 1. Open your terminal at the root of the project and write this

```bash
# 1.
python3 -m venv env
```

- 2. Activate the virtual environment

```bash
# 2.
source env/bin/activate
```

- 3. You're ready to go


### Project compilation, step-by-step

```bash
# 1. Install dependencies
make install

# Or manually install it:
python3 -m pip install -r requirements.txt
python3 -m pip install -e . --no-build-isolation
```

## Use

### Interactive mode

```bash
make run
```

### And voilà, there is your beautiful maze

![Final Maze Result](/blogs/a_maze_ing/maze-generation.png)

**Interactive menu (Sorry it's in Spanish) :**
- `1` - Generate new maze
- `2` - Shows/hides path
- `3` - Change walls colours
- `4` - Exit

### Show path

![Final Path](/blogs/a_maze_ing/path-solution.png)

### Change colours

![Final Change Colours](/blogs/a_maze_ing/change-color.png)

### As a library

See [`test_package.py`](test/test_package.py) for an example.

## The famous config file

File `config.txt`:

```plaintext
WIDTH=50
HEIGHT=50
ENTRY=1,3
EXIT=24,14
OUTPUT_FILE=output_maze.txt
PERFECT=True
```

**Parameters:**
- `WIDTH`, `HEIGHT`: Maze dimensions
- `ENTRY`: Entry as `x,y`
- `EXIT`: Exit as `x,y`
- `PERFECT`: `True` for perfect mazes, `False` imperfect ones.
- `OUTPUT_FILE`: Output file path, only `.txt`


## Project management

### Team
- **sfloresone**: Initial development, project architecture and documentation
- **Pabloms63**: Optimization, visualizer and documentation

### Quality management

```bash
# Clean generated
make clean      # Deletes __pycache__, dist/, .mypy_cache

# Build
make build      # Distribution with setuptools
```

## Technical notes

- **Visualizer**: ANSI colors (colores) and heavy Unicode (paredes gruesas)
  - Cannot render in limited terminals or native Windows CMD — worth keeping in mind if you expect output everywhere.

- **"42" Logo**: Requires min. 11×9 cells — below that, the pattern simply won't fit.

- **Output format**: Coordinates + Entry/Exit tuples + path (N/S/E/W) in plain text — readable without reopening the interactive session.

![Output File](/blogs/a_maze_ing/output-file.png)

## Also...

### You can generate the maze using a reproducible seed
```python
gen = MazeGenerator(20, 20, (0, 0), (19, 19), seed=42)
gen.generate_maze()
```

```plaintext
WIDTH=50
HEIGHT=50
ENTRY=1,3
EXIT=24,14
OUTPUT_FILE=output_maze.txt
PERFECT=True
SEED=42
```

Passing the same seed yields the same layout — useful when you want to compare pathfinding or export behaviour on an identical maze.

## Resources

- **Algorithms**:
  - [Recursive Backtracking](https://en.wikipedia.org/wiki/Maze_generation_algorithm#Recursive_backtracker)
  - [BFS Pathfinding](https://en.wikipedia.org/wiki/Breadth-first_search)

- **Internal documentation**: Docstrings in each module
