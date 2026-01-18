#!/bin/bash

SESSION_NAME="my_session"
COMMAND_TO_RUN="bun run src/index.ts" your desired command

# Start a new tmux session in the background and run the command in the first pane
tmux new-session -d -s $SESSION_NAME "$COMMAND_TO_RUN"

# Create the remaining 4 panes and run the command in each
for i in {1..4}; do
    # Split the window horizontally and execute the command in the new pane
    tmux split-window -t $SESSION_NAME -h "$COMMAND_TO_RUN"
done

# Optional: set a tiled layout for uniform pane sizes
tmux select-layout tiled

# Attach to the session to view the results
tmux attach-session -t $SESSION_NAME
