import { DatasetError, isDatasetError } from "@/lib/datasets/errors";
import { parseDataset } from "@/lib/datasets/server/parse-dataset";

const ERROR_STATUS: Record<DatasetError["code"], number> = {
  "invalid-upload": 400,
  "unsupported-format": 415,
  "file-too-large": 413,
  "invalid-file-content": 422,
  "empty-dataset": 422,
  "worksheet-limit-exceeded": 413,
  "no-visible-worksheet": 422,
  "worksheet-not-found": 422,
  "row-limit-exceeded": 413,
  "column-limit-exceeded": 413,
  "cell-limit-exceeded": 413,
  "cell-value-too-large": 413,
  "parse-failed": 422,
};

function errorResponse(error: DatasetError) {
  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
      },
    },
    { status: ERROR_STATUS[error.code] },
  );
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return errorResponse(
      new DatasetError(
        "invalid-upload",
        "Upload one CSV or XLSX file using multipart form data.",
      ),
    );
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll("file");

    if (files.length !== 1) {
      throw new DatasetError(
        "invalid-upload",
        "Upload exactly one CSV or XLSX file.",
      );
    }

    const sheetNameValue = formData.get("sheetName");

    if (sheetNameValue !== null && typeof sheetNameValue !== "string") {
      throw new DatasetError("invalid-upload", "The worksheet selection is invalid.");
    }

    const sheetName = sheetNameValue?.trim();

    if (sheetName && sheetName.length > 31) {
      throw new DatasetError("invalid-upload", "The worksheet name is invalid.");
    }

    const dataset = await parseDataset(files[0], {
      sheetName: sheetName || undefined,
    });

    return Response.json(dataset);
  } catch (error) {
    if (isDatasetError(error)) {
      return errorResponse(error);
    }

    return Response.json(
      {
        error: {
          code: "unexpected-error",
          message: "The dataset could not be processed. Please check the file and try again.",
        },
      },
      { status: 500 },
    );
  }
}
