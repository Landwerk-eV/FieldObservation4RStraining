# Field Observation for Remote Sensing Training

This documentation turns the presentation _Grassland Types&Management FieldObservation v06.may2026_ into a first structured reference for field observations that support remote-sensing model training.

The current focus is grassland characterisation for training and validation of satellite-based classification workflows, especially for Sentinel-1 and Sentinel-2 imagery.

## License and Citation

This project data is released under **CC0 1.0 Universal**.

While the data is CC0, we kindly request that users cite our associated Data Paper/Repository.

## Why this documentation exists

The repository currently serves two connected goals:

- provide a stable, versioned description of how field observations are captured and interpreted
- document the semantic tag set used to describe grassland types, events, status, intensity, and certainty
- prepare a public documentation surface that can evolve together with the observation database and training workflows

## Scope of the initial release

The first version covers the core ideas from the source presentation:

- project objectives and workflow
- imagery and observation processing steps
- grassland and crop type tags
- event and status tags
- intensity and certainty classes
- notation for time-bounded observations and overlapping tags
- publication flow from field collection to GitHub-based release

## Structure

- The _Grassland Observation Framework_ section explains purpose, workflow, and notation.
- Web UI installation and troubleshooting guidance is available at [Web UI Setup and Troubleshooting](framework/web-ui-setup.md).
- The _Classification Scheme_ section defines the initial tag set.
- The _Data Publication_ section documents how observations move into a versioned public resource.

## Source material

The source presentation is retained in this repository at [docs/Grassland Types&Management FieldObservation - v06.may2026.pptx](Grassland%20Types%26Management%20FieldObservation%20-%20v06.may2026.pptx).

The current markdown pages were reviewed against slides 1 to 20 of that file, with explicit reference tables integrated for:

- grassland type and management tags (slide 8)
- events (slide 10)
- intensity and certainty classes (slide 12)
