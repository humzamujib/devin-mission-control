"use client";

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import type {
  KnowledgeNote,
  KnowledgeFolder,
  KnowledgeFilter,
} from "@/types/knowledge";

const USER_NAME = "Humza Mujib";

export default function KnowledgePanel() {
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [folders, setFolders] = useState<KnowledgeFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<KnowledgeFilter>("mine");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<KnowledgeNote | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const [editName, setEditName] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editTrigger, setEditTrigger] = useState("");
  const [editFolder, setEditFolder] = useState<string | null>(null);
  const [editRepo, setEditRepo] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchKnowledge = useCallback(async () => {
    try {
      const res = await fetch("/api/devin/knowledge");
      if (!res.ok) return;
      const data = await res.json();
      setNotes(data.knowledge || []);
      setFolders(data.folders || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKnowledge();
  }, [fetchKnowledge]);

  const filteredNotes = notes.filter((n) => {
    if (filter === "mine") {
      const creatorName = n.created_by?.full_name || "";
      if (!creatorName.toLowerCase().includes("humza")) return false;
    } else if (filter === "org") {
      const creatorName = n.created_by?.full_name || "";
      if (creatorName.toLowerCase().includes("humza")) return false;
    }
    if (selectedFolder && n.parent_folder_id !== selectedFolder) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        n.name.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.trigger_description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  function openEditor(note: KnowledgeNote | null) {
    if (note) {
      setEditName(note.name);
      setEditBody(note.body);
      setEditTrigger(note.trigger_description);
      setEditFolder(note.parent_folder_id);
      setEditRepo(note.pinned_repo || "");
      setSelectedNote(note);
      setEditing(true);
      setCreating(false);
    } else {
      setEditName("");
      setEditBody("");
      setEditTrigger("");
      setEditFolder(selectedFolder);
      setEditRepo("");
      setSelectedNote(null);
      setEditing(true);
      setCreating(true);
    }
  }

  function closeEditor() {
    setEditing(false);
    setCreating(false);
    setSelectedNote(null);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      name: editName,
      body: editBody,
      trigger_description: editTrigger,
      parent_folder_id: editFolder || null,
      pinned_repo: editRepo || null,
    };

    if (creating) {
      await fetch("/api/devin/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else if (selectedNote) {
      await fetch(`/api/devin/knowledge/${selectedNote.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    closeEditor();
    fetchKnowledge();
  }

  async function handleDelete(noteId: string) {
    if (!confirm("Delete this knowledge note?")) return;
    await fetch(`/api/devin/knowledge/${noteId}`, { method: "DELETE" });
    if (selectedNote?.id === noteId) closeEditor();
    fetchKnowledge();
  }

  function viewNote(note: KnowledgeNote) {
    setSelectedNote(note);
    setEditing(false);
    setCreating(false);
  }

  const folderName = (id: string | null) =>
    folders.find((f) => f.id === id)?.name || "Root";

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Folder sidebar */}
      <div className="w-52 shrink-0 border-r border-t-border bg-t-bg/50 overflow-y-auto">
        <div className="px-3 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-t-text-muted">
            Scope
          </p>
          {(["mine", "org", "all"] as KnowledgeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setSelectedNote(null);
              }}
              className={`mb-0.5 w-full rounded px-2 py-1 text-left text-xs transition-colors ${
                filter === f
                  ? "bg-t-primary/20 text-t-accent"
                  : "text-t-text-secondary hover:bg-t-surface hover:text-t-text"
              }`}
            >
              {f === "mine" ? "My Notes" : f === "org" ? "Org Notes" : "All"}
            </button>
          ))}
        </div>
        <div className="border-t border-t-border px-3 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-t-text-muted">
            Folders
          </p>
          <button
            onClick={() => {
              setSelectedFolder(null);
              setSelectedNote(null);
            }}
            className={`mb-0.5 w-full rounded px-2 py-1 text-left text-xs transition-colors ${
              selectedFolder === null
                ? "bg-t-surface text-t-text"
                : "text-t-text-secondary hover:bg-t-surface hover:text-t-text"
            }`}
          >
            All Folders
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setSelectedFolder(f.id);
                setSelectedNote(null);
              }}
              className={`mb-0.5 w-full rounded px-2 py-1 text-left text-xs truncate transition-colors ${
                selectedFolder === f.id
                  ? "bg-t-surface text-t-text"
                  : "text-t-text-secondary hover:bg-t-surface hover:text-t-text"
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {/* Note list */}
      <div className="w-72 shrink-0 border-r border-t-border flex flex-col overflow-hidden">
        <div className="border-b border-t-border px-3 py-2 flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="flex-1 rounded border border-t-border bg-t-surface px-2 py-1 text-xs text-t-text placeholder-t-text-muted outline-none focus:border-t-primary"
          />
          <button
            onClick={() => openEditor(null)}
            className="shrink-0 rounded bg-t-primary px-2 py-1 text-xs font-medium text-t-text-bright hover:bg-t-primary-hover"
          >
            +
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-3 text-xs text-t-text-muted">Loading...</p>
          ) : filteredNotes.length === 0 ? (
            <p className="p-3 text-xs text-t-text-muted">No notes found</p>
          ) : (
            filteredNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => viewNote(note)}
                className={`w-full border-b border-t-border/50 px-3 py-2.5 text-left transition-colors ${
                  selectedNote?.id === note.id
                    ? "bg-t-surface"
                    : "hover:bg-t-surface-hover"
                }`}
              >
                <p className="text-xs font-medium text-t-text truncate">
                  {note.name}
                </p>
                <p className="mt-0.5 text-[10px] text-t-text-muted truncate">
                  {note.trigger_description}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[10px] text-t-text-muted">
                    {note.created_by?.full_name?.split(" ")[0] || "Unknown"}
                  </span>
                  {note.parent_folder_id && (
                    <span className="rounded bg-t-border px-1 py-0.5 text-[9px] text-t-text-muted">
                      {folderName(note.parent_folder_id)}
                    </span>
                  )}
                  {note.pinned_repo && (
                    <span className="rounded bg-t-border px-1 py-0.5 text-[9px] text-t-text-muted truncate max-w-[80px]">
                      {note.pinned_repo}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-t-border px-3 py-1.5 text-[10px] text-t-text-muted">
          {filteredNotes.length} of {notes.length} notes
        </div>
      </div>

      {/* Detail / Editor */}
      <div className="flex-1 overflow-y-auto">
        {editing ? (
          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-t-text-bright">
                {creating ? "New Knowledge Note" : "Edit Note"}
              </h3>
              <button
                onClick={closeEditor}
                className="text-xs text-t-text-muted hover:text-t-text-secondary"
              >
                Cancel
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-t-text-muted">
                  Name
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-t-border bg-t-surface px-3 py-2 text-sm text-t-text outline-none focus:border-t-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-t-text-muted">
                  Trigger (when should Devin use this?)
                </label>
                <input
                  value={editTrigger}
                  onChange={(e) => setEditTrigger(e.target.value)}
                  className="w-full rounded-lg border border-t-border bg-t-surface px-3 py-2 text-sm text-t-text outline-none focus:border-t-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-t-text-muted">
                  Body (markdown)
                </label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={12}
                  className="w-full rounded-lg border border-t-border bg-t-surface px-3 py-2 font-mono text-xs text-t-text outline-none focus:border-t-primary"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-t-text-muted">
                    Folder
                  </label>
                  <select
                    value={editFolder || ""}
                    onChange={(e) => setEditFolder(e.target.value || null)}
                    className="w-full rounded-lg border border-t-border bg-t-surface px-3 py-2 text-xs text-t-text outline-none focus:border-t-primary"
                  >
                    <option value="">Root (no folder)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-t-text-muted">
                    Pinned Repo
                  </label>
                  <input
                    value={editRepo}
                    onChange={(e) => setEditRepo(e.target.value)}
                    placeholder="owner/repo"
                    className="w-full rounded-lg border border-t-border bg-t-surface px-3 py-2 text-xs text-t-text placeholder-t-text-muted outline-none focus:border-t-primary"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={closeEditor}
                  className="rounded-lg border border-t-border px-4 py-2 text-xs text-t-text-secondary hover:bg-t-surface"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={
                    saving ||
                    !editName.trim() ||
                    !editBody.trim() ||
                    !editTrigger.trim()
                  }
                  className="rounded-lg bg-t-primary px-4 py-2 text-xs font-medium text-t-text-bright hover:bg-t-primary-hover disabled:opacity-50"
                >
                  {saving ? "Saving..." : creating ? "Create" : "Save"}
                </button>
              </div>
            </div>
          </div>
        ) : selectedNote ? (
          <div className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-t-text-bright">
                {selectedNote.name}
              </h3>
              <div className="flex items-center gap-2">
                {selectedNote.created_by?.full_name === USER_NAME && (
                  <>
                    <button
                      onClick={() => openEditor(selectedNote)}
                      className="rounded border border-t-border px-2 py-1 text-[10px] text-t-text-secondary hover:bg-t-surface"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(selectedNote.id)}
                      className="rounded border border-t-error/30 px-2 py-1 text-[10px] text-t-error hover:bg-t-error/10"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="rounded bg-t-border px-2 py-0.5 text-[10px] text-t-text-secondary">
                {selectedNote.created_by?.full_name || "Unknown"}
              </span>
              {selectedNote.parent_folder_id && (
                <span className="rounded bg-t-border px-2 py-0.5 text-[10px] text-t-text-secondary">
                  {folderName(selectedNote.parent_folder_id)}
                </span>
              )}
              {selectedNote.pinned_repo && (
                <span className="rounded bg-t-border px-2 py-0.5 text-[10px] text-t-accent">
                  {selectedNote.pinned_repo}
                </span>
              )}
            </div>
            <div className="mb-4 rounded-lg border border-t-border bg-t-surface px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-t-text-muted mb-1">
                Trigger
              </p>
              <p className="text-xs text-t-text">
                {selectedNote.trigger_description}
              </p>
            </div>
            <div className="prose-messages text-xs text-t-text">
              <ReactMarkdown>{selectedNote.body}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-t-text-muted">
              Select a note to view, or create a new one
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
