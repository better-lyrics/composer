// -- Interfaces ----------------------------------------------------------------

interface HelpTableRow {
  key: string;
  cells: readonly React.ReactNode[];
}

interface HelpTableProps {
  head: readonly string[];
  rows: readonly HelpTableRow[];
}

// -- Components ----------------------------------------------------------------

const HelpTable: React.FC<HelpTableProps> = ({ head, rows }) => (
  <table className="mt-2 w-full border-collapse text-sm leading-[1.5]">
    <thead>
      <tr className="shadow-[inset_0_-1px_0_0_var(--divider)]">
        {head.map((label, index) => (
          <th
            key={`${label}-${index}`}
            scope="col"
            className="py-1.5 pr-4 text-left align-bottom text-xs font-medium text-composer-text-muted select-none"
          >
            {label}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map(({ key, cells }) => (
        <tr key={key} className="shadow-[inset_0_-1px_0_0_var(--divider)] last:shadow-none">
          {cells.map((cell, cellIndex) =>
            cellIndex === 0 ? (
              <th
                key={`${key}-head`}
                scope="row"
                className="py-2 pr-4 text-left align-top font-medium text-composer-text"
              >
                {cell}
              </th>
            ) : (
              <td key={`${key}-${cellIndex}`} className="py-2 pr-4 align-top text-(--label) text-pretty">
                {cell}
              </td>
            ),
          )}
        </tr>
      ))}
    </tbody>
  </table>
);

// -- Exports -------------------------------------------------------------------

export { HelpTable };
export type { HelpTableRow };
