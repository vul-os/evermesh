import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getUploadStatus, upload } from "../api.js";
import { useMe } from "../hooks/useMe.js";

const LICENSES = ["all-rights-reserved", "cc-by", "cc-by-sa", "cc-by-nc", "cc0", "public-domain"];

export function Upload(): JSX.Element {
  const { data: me, isLoading: meLoading } = useMe();

  if (meLoading) {
    return (
      <p role="status" className="py-10 text-sm text-slate-500 dark:text-slate-400">
        Loading…
      </p>
    );
  }
  if (!me) {
    return (
      <p role="alert" className="py-10 text-sm">
        <Link to="/auth" className="font-medium text-brand-700 underline dark:text-brand-200">
          Sign in
        </Link>{" "}
        to upload a video.
      </p>
    );
  }
  return <UploadForm />;
}

function UploadForm(): JSX.Element {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [license, setLicense] = useState(LICENSES[0]);
  // GAP: API.md's upload form takes a freeform `channelId`, but there's
  // no endpoint listing "my channels" to populate a dropdown with. Left
  // as a plain optional text input until the contract adds one.
  const [channelId, setChannelId] = useState("");
  const [uploadId, setUploadId] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("choose a file first");
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      return upload(file, { title, description: description || undefined, tags: tagList.length ? tagList : undefined, channelId: channelId || undefined, license });
    },
    onSuccess: (res) => setUploadId(res.uploadId),
  });

  const statusQuery = useQuery({
    queryKey: ["upload", uploadId],
    queryFn: () => getUploadStatus(uploadId as string),
    enabled: Boolean(uploadId),
    refetchInterval: (query) => (query.state.data?.status === "processing" ? 1500 : false),
  });

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    uploadMutation.mutate();
  };

  const done = statusQuery.data?.status === "published" || statusQuery.data?.status === "failed";

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-xl font-semibold">Upload a video</h1>

      {!uploadId || !done ? (
        <form onSubmit={onSubmit} className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`rounded-lg border-2 border-dashed p-6 text-center text-sm ${dragOver ? "border-accent-500 bg-accent-50 dark:bg-accent-950" : "border-slate-300 dark:border-slate-700"}`}
          >
            <label htmlFor="file-input" className="block cursor-pointer">
              {file ? `Selected: ${file.name}` : "Drag and drop a video file here, or click to choose one"}
            </label>
            <input id="file-input" type="file" accept="video/*" onChange={onFileInput} className="mt-2 block w-full text-sm" />
          </div>

          <label className="block text-sm font-medium">
            Title
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <label className="block text-sm font-medium">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <label className="block text-sm font-medium">
            Tags (comma-separated)
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <label className="block text-sm font-medium">
            License
            <select
              value={license}
              onChange={(e) => setLicense(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
            >
              {LICENSES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Channel id (optional)
            <input
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <button
            type="submit"
            disabled={!file || !title.trim() || uploadMutation.isPending}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {uploadMutation.isPending ? "Uploading…" : "Upload"}
          </button>

          {uploadMutation.isError && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {uploadMutation.error instanceof Error ? uploadMutation.error.message : "Upload failed."}
            </p>
          )}
        </form>
      ) : null}

      {uploadId && (
        <div className="mt-6 rounded-lg border border-slate-200 p-4 dark:border-slate-700" role="status" aria-live="polite">
          <p className="text-sm font-medium">Processing status: {statusQuery.data?.status ?? "checking…"}</p>
          {typeof statusQuery.data?.progress === "number" && (
            <div className="mt-2 h-2 w-full rounded bg-slate-200 dark:bg-slate-800">
              <div
                className="h-2 rounded bg-accent-500"
                style={{ width: `${Math.round(statusQuery.data.progress * 100)}%` }}
              />
            </div>
          )}
          {statusQuery.data?.status === "published" && statusQuery.data.manifestId && (
            <p className="mt-2 text-sm">
              Published.{" "}
              <Link to={`/watch/${encodeURIComponent(statusQuery.data.manifestId)}`} className="font-medium text-brand-700 underline dark:text-brand-200">
                Watch it now
              </Link>
              .
            </p>
          )}
          {statusQuery.data?.status === "failed" && (
            <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
              {statusQuery.data.error ?? "Upload processing failed."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
