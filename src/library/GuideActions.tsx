import { ConfirmModal, Menu, MenuItem, TextField, showContextMenu, showModal } from "@decky/ui";
import { toaster } from "@decky/api";
import { useState } from "react";
import { api, errorMessage } from "../api";
import { setState, getState } from "../store";
import type { GuideMeta } from "../types";

/** X on a guide: a small menu with Rename and Delete. */
export function showGuideMenu(guide: GuideMeta, anchor?: EventTarget) {
  showContextMenu(
    <Menu label={guide.title} cancelText="Cancel">
      <MenuItem onClick={() => showModal(<RenameModal guide={guide} />)}>Rename</MenuItem>
      <MenuItem tone="destructive" onClick={() => showModal(<DeleteModal guide={guide} />)}>
        Delete
      </MenuItem>
    </Menu>,
    anchor,
  );
}

function applyMeta(meta: GuideMeta) {
  const guides = getState().guides;
  if (guides) setState({ guides: guides.map((g) => (g.id === meta.id ? meta : g)) });
}

function RenameModal({ guide, closeModal }: { guide: GuideMeta; closeModal?: () => void }) {
  const [title, setTitle] = useState(guide.title);
  const [busy, setBusy] = useState(false);
  const trimmed = title.trim();
  return (
    <ConfirmModal
      strTitle="Rename guide"
      strOKButtonText="Rename"
      bOKDisabled={busy || !trimmed || trimmed === guide.title}
      closeModal={closeModal}
      onOK={async () => {
        setBusy(true);
        try {
          applyMeta(await api.rename_guide(guide.id, trimmed));
          closeModal?.();
        } catch (e) {
          setBusy(false);
          toaster.toast({ title: "Couldn't rename", body: errorMessage(e) });
        }
      }}
    >
      <TextField label="Title" value={title} focusOnMount onChange={(e) => setTitle(e.target.value)} />
      <div className="dbx-modal-note" style={{ fontSize: 13, color: "#8b95a5", marginTop: 8 }}>
        Only the title shown on the Deck changes. To edit the content, upload a new version of the file.
      </div>
    </ConfirmModal>
  );
}

function DeleteModal({ guide, closeModal }: { guide: GuideMeta; closeModal?: () => void }) {
  return (
    <ConfirmModal
      strTitle="Delete guide?"
      strDescription={`"${guide.title}" for ${guide.game_name} and its checklist progress will be removed from this Deck.`}
      strOKButtonText="Delete"
      bDestructiveWarning
      closeModal={closeModal}
      onOK={async () => {
        try {
          await api.delete_guide(guide.id);
          const guides = getState().guides;
          if (guides) setState({ guides: guides.filter((g) => g.id !== guide.id) });
        } catch (e) {
          toaster.toast({ title: "Couldn't delete", body: errorMessage(e) });
        }
      }}
    />
  );
}
