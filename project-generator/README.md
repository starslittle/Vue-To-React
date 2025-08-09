# Project Generator Service

This is a simple Node.js service that generates a complete React project structure based on the content of an `image_react.txt` file.

## Prerequisites

- Node.js installed.
- An `image_react.txt` file must be present in the root directory of this service.

## Installation

1.  Navigate to the `project-generator` directory.
2.  Run the following command to install the necessary dependencies:
    ```bash
    npm install
    ```

## Running the Service

To start the server, run the following command from the `project-generator` directory:

```bash
npm start
```

The service will start and listen on port 3001.

## Usage

To generate the project, send a POST request to the `/generate-project` endpoint.

You can use `curl` to trigger the project generation:

```bash
curl -X POST http://localhost:3001/generate-project
```

Upon successful execution, a new directory named `generated_react_project` will be created in the `project-generator` directory, containing all the files and code specified in `image_react.txt`. 