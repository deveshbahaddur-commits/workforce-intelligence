import { useState } from "react";
import type { ReporteeNode } from "../api/kraKpiClient.js";

interface ReporteeTreeProps {
  nodes: ReporteeNode[];
  selectedEmployeeId: string | null;
  onSelect: (employeeId: string) => void;
}

/** Root list: a manager's direct reports, always visible. */
export default function ReporteeTree({ nodes, selectedEmployeeId, onSelect }: ReporteeTreeProps) {
  if (nodes.length === 0) {
    return <p className="reportee-empty">No direct reports.</p>;
  }
  return (
    <ul className="reportee-tree">
      {nodes.map((node) => (
        <ReporteeNodeItem key={node.employeeId} node={node} selectedEmployeeId={selectedEmployeeId} onSelect={onSelect} />
      ))}
    </ul>
  );
}

interface ReporteeNodeItemProps {
  node: ReporteeNode;
  selectedEmployeeId: string | null;
  onSelect: (employeeId: string) => void;
}

/**
 * One reportee row, collapsed by default. Indirect reportees (this node's
 * own reports) only render once expanded — each node owns its own expand
 * state, so expanding one branch doesn't affect siblings.
 */
function ReporteeNodeItem({ node, selectedEmployeeId, onSelect }: ReporteeNodeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasIndirectReports = node.reports.length > 0;

  return (
    <li>
      <div
        className={`reportee-node${selectedEmployeeId === node.employeeId ? " reportee-node--selected" : ""}`}
        style={{ paddingLeft: `${(node.depth - 1) * 16}px` }}
      >
        {hasIndirectReports ? (
          <button
            type="button"
            className={`reportee-expand${expanded ? " reportee-expand--open" : ""}`}
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={
              expanded
                ? "Hide indirect reportees"
                : `Show ${node.reports.length} indirect reportee${node.reports.length === 1 ? "" : "s"}`
            }
          >
            ▸
          </button>
        ) : (
          <span className="reportee-expand-spacer" />
        )}
        <button type="button" className="reportee-select" onClick={() => onSelect(node.employeeId)}>
          <span className="reportee-name">{node.name}</span>
          <span className="reportee-role">{node.role}</span>
          {hasIndirectReports && (
            <span className="reportee-hint">
              {node.reports.length} indirect{expanded ? " (shown below)" : ""}
            </span>
          )}
        </button>
      </div>
      {hasIndirectReports && expanded && (
        <ul className="reportee-tree reportee-tree--nested">
          {node.reports.map((child) => (
            <ReporteeNodeItem key={child.employeeId} node={child} selectedEmployeeId={selectedEmployeeId} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}
