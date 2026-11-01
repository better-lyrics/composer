import { useSettingsStore } from "@/stores/settings";
import { Button } from "@/ui/button";
import { LoupeSizeLayer } from "@/ui/settings/loupe-size/loupe-size-layer";
import { SettingRowLayout } from "@/ui/settings/setting-row-layout";
import { SettingText } from "@/ui/settings/setting-text";
import { useState } from "react";

// -- Component ----------------------------------------------------------------

const LoupeSizeSetting: React.FC = () => {
  const loupeWidth = useSettingsStore((s) => s.loupeWidth);
  const loupeHeight = useSettingsStore((s) => s.loupeHeight);
  const [open, setOpen] = useState(false);

  return (
    <SettingRowLayout>
      <SettingText id="loupeSize" />
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-medium font-mono tabular-nums select-text">
          {loupeWidth} × {loupeHeight}
        </span>
        <Button variant="secondary" size="md" aria-haspopup="dialog" onClick={() => setOpen(true)}>
          Adjust
        </Button>
      </div>
      <LoupeSizeLayer open={open} onClose={() => setOpen(false)} />
    </SettingRowLayout>
  );
};

// -- Exports ------------------------------------------------------------------

export { LoupeSizeSetting };
