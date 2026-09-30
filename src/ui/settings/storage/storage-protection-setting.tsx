import { useStorageProtection } from "@/hooks/useStorageProtection";
import { StorageProtectionRow } from "@/ui/settings/storage/storage-protection-row";
import { BROWSER_KIND } from "@/utils/platform";

// -- Component ----------------------------------------------------------------

const StorageProtectionSetting: React.FC = () => {
  const { status, isProtecting, protect } = useStorageProtection();

  return (
    <StorageProtectionRow
      status={status}
      browser={BROWSER_KIND}
      isProtecting={isProtecting}
      onProtect={() => void protect()}
    />
  );
};

// -- Exports ------------------------------------------------------------------

export { StorageProtectionSetting };
