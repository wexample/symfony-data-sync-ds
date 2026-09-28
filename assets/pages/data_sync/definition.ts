import Page from '@wexample/symfony-loader/js/Class/Page';
import RoutingService from '@wexample/symfony-loader/js/Services/RoutingService';
import { unwrapApiEnvelope } from '@wexample/js-api-entity/Common/ApiEnvelope';

type Side = { id: string; fields: Record<string, unknown> } | null;

type Diff = {
  localField: string;
  remoteField: string;
  localValue: unknown;
  remoteValue: unknown;
  target: 'local' | 'remote' | 'none';
};

type Relation = {
  definition: string;
  operation: string;
  reason: string;
  outcome: string;
  message: string | null;
  local: Side;
  remote: Side;
  link: { localId: string; remoteId: string } | null;
  diffs: Diff[];
};

type Report = {
  dryRun: boolean;
  relations: Relation[];
};

const ROUTE_LINK = 'api_data_sync_link';
const ROUTE_PLAN = 'api_data_sync_plan';
const ROUTE_RUN = 'api_data_sync_run';
const OPERATION_CANDIDATE = 'candidate';
const OPERATION_LOADING = 'loading';

/**
 * Loads the definition's plan as a dry run, shows each relation with its field
 * differences side by side, and lets a human link a candidate or apply the plan.
 */
export default class extends Page {
  private definitionKey = '';

  pageReady() {
    const root = this.el?.querySelector<HTMLElement>('.data-sync--definition');
    this.definitionKey = root?.dataset.definition ?? '';

    this.el?.querySelector('.data-sync--refresh')?.addEventListener('click', () => void this.plan());
    this.el?.querySelector<HTMLButtonElement>('.data-sync--apply')?.addEventListener('click', (event) => {
      const button = event.currentTarget as HTMLButtonElement;

      if (window.confirm(button.dataset.confirm ?? '')) {
        void this.apply();
      }
    });

    void this.plan();
  }

  private async plan(): Promise<void> {
    await this.call(ROUTE_PLAN, 'GET');
  }

  private async apply(): Promise<void> {
    await this.call(ROUTE_RUN, 'POST');
  }

  private async link(localId: string, remoteId: string): Promise<void> {
    try {
      await this.request(ROUTE_LINK, 'POST', { localId, remoteId });
    } catch (error) {
      this.setStatus(this.errorMessage(error));

      return;
    }

    await this.plan();
  }

  /**
   * Runs the plan endpoint or the run endpoint, and renders the report it answers.
   */
  private async call(route: string, method: 'GET' | 'POST'): Promise<void> {
    this.setBusy(true);
    this.renderLoading();

    try {
      this.render(await this.request<Report>(route, method));
    } catch (error) {
      this.relationsBody().replaceChildren();
      this.setStatus(this.errorMessage(error));
    } finally {
      this.setBusy(false);
    }
  }

  private async request<T>(route: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
    const url = (this.app.getService(RoutingService) as RoutingService).path(route, { key: this.definitionKey });
    const response = await fetch(url, {
      method,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    return unwrapApiEnvelope<T>(await response.json());
  }

  private render(report: Report): void {
    const rows: HTMLElement[] = [];

    for (const relation of report.relations) {
      rows.push(this.relationRow(relation));

      if (relation.diffs.length > 0) {
        rows.push(this.diffRow(relation));
      }
    }

    this.relationsBody().replaceChildren(...rows);
    this.setStatus(
      report.relations.length === 0
        ? this.label('empty')
        : this.label(report.dryRun ? 'dryRun' : 'applied')
    );
  }

  private renderLoading(): void {
    const row = document.createElement('tr');
    row.className = 'table--row';
    row.append(this.cell(this.marker(OPERATION_LOADING)));
    this.relationsBody().replaceChildren(row);
    this.setStatus('');
  }

  private relationRow(relation: Relation): HTMLElement {
    const row = document.createElement('tr');
    row.className = 'table--row';

    row.append(
      this.cell(this.marker(relation.operation)),
      this.cell(this.sideText(relation.local, relation.link?.localId)),
      this.cell(this.sideText(relation.remote, relation.link?.remoteId)),
      this.cell(relation.reason),
      this.cell(relation.outcome + (relation.message ? `: ${relation.message}` : '')),
      this.cell(this.actions(relation, row)),
    );

    return row;
  }

  private actions(relation: Relation, row: HTMLElement): Node {
    const container = document.createElement('span');

    if (relation.operation === OPERATION_CANDIDATE && relation.local && relation.remote) {
      const localId = relation.local.id;
      const remoteId = relation.remote.id;
      container.append(this.button(this.label('link'), () => void this.link(localId, remoteId)));
    }

    if (relation.diffs.length > 0) {
      container.append(this.button(this.label('diff'), () => {
        const diffRow = row.nextElementSibling as HTMLElement | null;

        if (diffRow) {
          diffRow.hidden = !diffRow.hidden;
        }
      }));
    }

    return container;
  }

  /**
   * The two panes: each differing field with its local value, the direction it
   * will travel, and its remote value; the side that will be written is marked.
   */
  private diffRow(relation: Relation): HTMLElement {
    const table = document.createElement('table');
    table.className = 'table data-sync--diff';

    const head = document.createElement('tr');
    head.className = 'table--row';
    for (const title of [this.label('field'), this.label('local'), '', this.label('remote')]) {
      const th = document.createElement('th');
      th.className = 'table--cell';
      th.textContent = title;
      head.append(th);
    }
    table.append(head);

    for (const diff of relation.diffs) {
      const line = document.createElement('tr');
      line.className = 'table--row';

      const local = this.cell(this.valueText(diff.localValue));
      const remote = this.cell(this.valueText(diff.remoteValue));
      local.classList.toggle('is-written', diff.target === 'local');
      remote.classList.toggle('is-written', diff.target === 'remote');

      const target = this.cell({ local: '←', remote: '→', none: '?' }[diff.target]);
      target.classList.add('data-sync--target');

      line.append(this.cell(`${diff.localField} / ${diff.remoteField}`), local, target, remote);
      table.append(line);
    }

    const row = document.createElement('tr');
    row.className = 'table--row';
    row.hidden = true;
    const cell = document.createElement('td');
    cell.className = 'table--cell';
    cell.colSpan = 6;
    cell.append(table);
    row.append(cell);

    return row;
  }

  private marker(operation: string): Node {
    const template = this.el?.querySelector<HTMLTemplateElement>(`.data-sync--marker[data-operation="${operation}"]`);

    return template ? template.content.cloneNode(true) : document.createTextNode(operation);
  }

  private sideText(side: Side, fallbackId?: string): string {
    if (!side) {
      return fallbackId ?? '';
    }

    const summary = Object.values(side.fields)
      .filter((value) => typeof value === 'string' && value !== '')
      .slice(0, 2)
      .join(' · ');

    return summary ? `${side.id} — ${summary}` : side.id;
  }

  private valueText(value: unknown): string {
    if (value === null || value === undefined) {
      return '∅';
    }

    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  private cell(content: string | Node): HTMLTableCellElement {
    const cell = document.createElement('td');
    cell.className = 'table--cell data-sync--cell-wrap';
    cell.append(content);

    return cell;
  }

  private button(text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button';
    button.textContent = text;
    button.addEventListener('click', onClick);

    return button;
  }

  private relationsBody(): HTMLElement {
    return this.el?.querySelector<HTMLElement>('.data-sync--relations') as HTMLElement;
  }

  private label(name: string): string {
    return this.el?.querySelector<HTMLElement>('.data-sync--labels')?.dataset[name] ?? name;
  }

  private setStatus(text: string): void {
    const status = this.el?.querySelector('.data-sync--status');

    if (status) {
      status.textContent = text;
    }
  }

  private setBusy(busy: boolean): void {
    this.el?.querySelectorAll<HTMLButtonElement>('.data-sync--actions button').forEach((button) => {
      button.disabled = busy;
    });
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
