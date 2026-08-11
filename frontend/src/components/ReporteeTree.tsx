import type { ReporteeNode } from "../api/kraKpiClient.js";

interface ReporteeTreeProps {
  nodes: ReporteeNode[];
  selectedEmployeeId: string | null;
  onSelect: (employeeId: string) => void;
}

export default function ReporteeTree({ nodes, selectedEmployeeId, onSelect }: ReporteeTreeProps) {
  if (nodes.length === 0) {
    return <p className="reportee-empty">No reportees.</p>;
  }
  return (
    <ul className="reportee-tree">
      {nodes.map((node) => (
        <li key={node.employeeId}>
          <button
            className={`reportee-node${selectedEmployeeId === node.employeeId ? " reportee-node--selected" : ""}`}
            style={{ paddingLeft: `${8 + (node.depth - 1) * 16}px` }}
            onClick={() => onSelect(node.employeeId)}
          >
            <span className="reportee-name">{node.name}</span>
            <span className="reportee-role">{node.role}</span>
            <span className={`reportee-badge${node.depth > 1 ? " reportee-badge--indirect" : ""}`}>
              {node.depth === 1 ? "Direct" : "Indirect"}
            </span>
          </button>
          {node.reports.length > 0 && (
            <ReporteeTree nodes={node.reports} selectedEmployeeId={selectedEmployeeId} onSelect={onSelect} />
          )}
        </li>
      ))}
    </ul>
  );
}
