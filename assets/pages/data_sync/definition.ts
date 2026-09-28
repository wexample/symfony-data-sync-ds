import Page from '@wexample/symfony-loader/js/Class/Page';
import RoutingService from '@wexample/symfony-loader/js/Services/RoutingService';
import { unwrapApiEnvelope } from '@wexample/js-api-entity/Common/ApiEnvelope';
import type ConfirmService from '@wexample/symfony-design-system/js/Services/ConfirmService';

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
  side: 'local' | 'remote' | null;
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
const ROUTE_RESOLVE = 'api_data_sync_resolve';
const ROUTE_RUN = 'api_data_sync_run';
const OPERATION_CANDIDATE = 'candidate';
const OPERATION_CONFLICT = 'conflict';
const OPERATION_LOADING = 'loading';
const COLUMNS = 6;
// The fields a side is best known by, first found first shown.
const NAME_FIELDS = ['name', 'display_name', 'displayName', 'title', 'label', 'username', 'email'];

/**
 * Loads the definition's plan as a dry run, shows each relation with its field
 * differences side by side, and lets a human link a candidate, settle a field
 * conflict by keeping one side, or apply the plan.
 */
export default class extends Page {
  private definitionKey = '';

  pageReady() {
    const root = this.el?.querySelector<HTMLElement>('.data-sync--definition');
    this.definitionKey = root?.dataset.definition ?? '';

    this.el?.querySelector('.data-sync--refresh')?.addEventListener('click', () => void this.plan());
    this.el?.querySelector<HTMLButtonElement>('.data-sync--apply')?.addEventListener('click', async (event) => {
      const button = event.currentTarget as HTMLButtonElement;

      if (await this.askConfirmation(button.dataset.confirm ?? '')) {
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
    await this.act(ROUTE_LINK, { localId, remoteId });
  }

  private async resolve(localId: string, kept: 'local' | 'remote'): Promise<void> {
    await this.act(ROUTE_RESOLVE, { localId, kept });
  }

  /**
   * Posts a human decision, then plans again to show what is left.
   */
  private async act(route: string, body: unknown): Promise<void> {
    try {
      await this.request(route, 'POST', body);
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
      this.overview().replaceChildren();
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
      const row = this.relationRow(relation);
      rows.push(row);

      if (relation.diffs.length > 0) {
        rows.push(this.diffRow(relation, row));
      }
    }

    if (rows.length === 0) {
      rows.push(this.fullRow(this.label('empty'), 'text-empty'));
    }

    this.relationsBody().replaceChildren(...rows);
    this.renderOverview(report.relations);
    this.setStatus(
      report.relations.length === 0
        ? ''
        : this.label(report.dryRun ? 'dryRun' : 'applied')
    );
  }

  private renderLoading(): void {
    this.relationsBody().replaceChildren(this.fullRow(this.marker(OPERATION_LOADING)));
    this.overview().replaceChildren(this.marker(OPERATION_LOADING));
    this.setStatus('');
  }

  // One marker per operation the plan holds, with how many: the plan at a
  // glance before its rows.
  private renderOverview(relations: Relation[]): void {
    const counts = new Map<string, number>();

    for (const relation of relations) {
      counts.set(relation.operation, (counts.get(relation.operation) ?? 0) + 1);
    }

    this.overview().replaceChildren(...Array.from(counts, ([operation, count]) => this.marker(operation, count)));
  }

  private relationRow(relation: Relation): HTMLElement {
    const row = document.createElement('tr');
    row.className = `table--row data-sync--relation data-sync--relation--${relation.operation}`;

    const reason = document.createElement('span');
    reason.className = 'data-sync--reason';
    reason.textContent = relation.reason + (relation.message ? ` — ${relation.message}` : '');

    row.append(
      this.cell(this.marker(relation.operation)),
      this.cell(this.side(relation.local, relation.link?.localId)),
      this.cell(this.direction(relation), 'table--cell--fit'),
      this.cell(this.side(relation.remote, relation.link?.remoteId)),
      this.cell(reason),
      this.cell(this.actions(relation, row), 'table--cell--fit'),
    );

    return row;
  }

  private actions(relation: Relation, row: HTMLElement): Node {
    const container = document.createElement('span');
    container.className = 'data-sync--row-actions';

    if (relation.operation === OPERATION_CANDIDATE && relation.local && relation.remote) {
      const localId = relation.local.id;
      const remoteId = relation.remote.id;
      container.append(this.button('link', this.label('link'), () => void this.link(localId, remoteId)));
    }

    if (relation.diffs.length > 0) {
      const toggle = this.iconButton('diff', this.label('diff'), () => {
        const diffRow = row.nextElementSibling as HTMLElement | null;

        if (diffRow) {
          diffRow.hidden = !diffRow.hidden;
          toggle.setAttribute('aria-expanded', String(!diffRow.hidden));
        }
      });
      toggle.classList.add('data-sync--diff-toggle');
      container.append(toggle);
    }

    return container;
  }

  /**
   * The fields that differ, the two values facing each other across the way
   * they will travel: the one overwritten struck, the one that wins in full.
   * Open from the start where the visitor has a decision to take.
   */
  private diffRow(relation: Relation, relationRow: HTMLElement): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'data-sync--diff';

    for (const title of [this.label('field'), this.label('local'), '', this.label('remote')]) {
      grid.append(this.span('data-sync--diff-head', title));
    }

    for (const diff of relation.diffs) {
      const local = this.span('data-sync--diff-value', this.valueText(diff.localValue));
      const remote = this.span('data-sync--diff-value', this.valueText(diff.remoteValue));
      local.classList.toggle('data-sync--diff-value--overwritten', diff.target === 'local');
      local.classList.toggle('data-sync--diff-value--winning', diff.target === 'remote');
      remote.classList.toggle('data-sync--diff-value--overwritten', diff.target === 'remote');
      remote.classList.toggle('data-sync--diff-value--winning', diff.target === 'local');

      const arrow = this.span('data-sync--diff-arrow', '');
      arrow.append(this.icon({ local: 'to-local', remote: 'to-remote', none: 'both' }[diff.target]));

      const field = diff.localField === diff.remoteField ? diff.localField : `${diff.localField} · ${diff.remoteField}`;
      grid.append(this.span('data-sync--diff-field', field), local, arrow, remote);
    }

    // A field conflict on a known pair is settled here, beside the values it
    // chooses between; an ambiguous match has no diffs to settle.
    if (relation.operation === OPERATION_CONFLICT && relation.local && relation.remote) {
      const localId = relation.local.id;
      const decisions = this.span('data-sync--diff-actions', '');
      decisions.append(
        this.button('keep-local', this.label('keepLocal'), () => void this.resolve(localId, 'local')),
        this.button('keep-remote', this.label('keepRemote'), () => void this.resolve(localId, 'remote')),
      );
      grid.append(decisions);
    }

    const row = this.fullRow(grid);
    row.classList.add('data-sync--diff-row');
    row.hidden = relation.operation !== OPERATION_CONFLICT;
    relationRow.querySelector('.data-sync--diff-toggle')?.setAttribute('aria-expanded', String(!row.hidden));

    return row;
  }

  // The way the relation writes, pointing at the side that changes.
  private direction(relation: Relation): Node {
    const wrap = this.span('data-sync--direction', '');
    const name = relation.side === 'local' ? 'to-local' : relation.side === 'remote' ? 'to-remote' : relation.local && relation.remote ? 'both' : 'none';
    wrap.classList.toggle('data-sync--direction--active', relation.side !== null && relation.side !== undefined);
    wrap.append(this.icon(name));

    return wrap;
  }

  private side(side: Side, fallbackId?: string): Node {
    const wrap = this.span('data-sync--side', '');

    if (!side) {
      wrap.classList.add('data-sync--side--missing');
      wrap.append(this.span('data-sync--side-id', fallbackId ?? '—'));

      return wrap;
    }

    const name = NAME_FIELDS.map((key) => side.fields[key]).find((value) => typeof value === 'string' && value !== '') as string | undefined;
    wrap.append(this.span('data-sync--side-name', name ?? side.id));

    if (name) {
      wrap.append(this.span('data-sync--side-id', side.id));
    }

    return wrap;
  }

  private marker(operation: string, count?: number): Node {
    const template = this.el?.querySelector<HTMLTemplateElement>(`.data-sync--marker[data-operation="${operation}"]`);

    if (!template) {
      return document.createTextNode(operation);
    }

    const fragment = template.content.cloneNode(true) as DocumentFragment;

    if (count !== undefined) {
      fragment.querySelector('.marker')?.append(this.span('marker--count', String(count)));
    }

    return fragment;
  }

  private icon(name: string): Node {
    const template = this.el?.querySelector<HTMLTemplateElement>(`.data-sync--icon[data-name="${name}"]`);

    return template ? template.content.cloneNode(true) : document.createTextNode('');
  }

  private valueText(value: unknown): string {
    if (value === null || value === undefined) {
      return '∅';
    }

    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  private cell(content: string | Node, className?: string): HTMLTableCellElement {
    const cell = document.createElement('td');
    cell.className = 'table--cell' + (className ? ` ${className}` : '');
    cell.append(content);

    return cell;
  }

  private fullRow(content: string | Node, className?: string): HTMLElement {
    const row = document.createElement('tr');
    row.className = 'table--row';
    const cell = this.cell(content, className);
    cell.colSpan = COLUMNS;
    row.append(cell);

    return row;
  }

  private span(className: string, text: string): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;

    return span;
  }

  // A decision: a button that says what it does.
  private button(icon: string, text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button';
    const glyph = this.span('button--icon', '');
    glyph.append(this.icon(icon));
    button.append(glyph, this.span('', text));
    button.addEventListener('click', onClick);

    return button;
  }

  // Showing or hiding something: a round icon, its word in the tooltip.
  private iconButton(icon: string, text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-icon';
    button.setAttribute('aria-label', text);
    button.dataset.tooltip = text;
    button.append(this.icon(icon));
    button.addEventListener('click', onClick);

    return button;
  }

  // The system's confirm where the app has one, the browser's otherwise.
  private async askConfirmation(message: string): Promise<boolean> {
    const root = this.el?.querySelector<HTMLElement>('.data-sync--definition');
    const confirmService = (this.app.services as Record<string, unknown>).confirm as ConfirmService | undefined;

    if (!confirmService) {
      return window.confirm(message);
    }

    const result = await confirmService.confirm({
      title: root?.dataset.applyTitle,
      message,
      actions: [
        { key: 'y', value: 'ok', label: root?.dataset.applyAccept ?? 'Ok', role: 'primary' },
        { key: 'n', value: 'cancel', label: root?.dataset.cancel ?? 'Cancel', role: 'secondary' },
      ],
    });

    return result === 'ok';
  }

  private overview(): HTMLElement {
    return this.el?.querySelector<HTMLElement>('.data-sync--overview') as HTMLElement;
  }

  private relationsBody(): HTMLElement {
    return this.el?.querySelector<HTMLElement>('.data-sync--relations') as HTMLElement;
  }

  private label(name: string): string {
    return this.el?.querySelector<HTMLElement>('.data-sync--labels')?.dataset[name] ?? name;
  }

  private setStatus(text: string): void {
    const status = this.el?.querySelector<HTMLElement>('.data-sync--status');
    const target = status?.querySelector('.data-sync--status-text');

    if (status && target) {
      target.textContent = text;
      status.hidden = text === '';
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
