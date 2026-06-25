import React, { Fragment, useRef } from 'react';
import styles from './Table.module.css';

const joinClassNames = (...classNames) => classNames.filter(Boolean).join(' ');
const ICON_COLUMN_KEYS = new Set(['select', 'qr_code', 'delete']);

const getValue = (valueOrFactory, context) => {
	if (typeof valueOrFactory === 'function') {
		return valueOrFactory(context);
	}

	return valueOrFactory;
};

function Table({
	columns = [],
	rows = [],
	getRowId = (row) => row?.id,
	loading = false,
	error = '',
	emptyMessage = 'No data found',
	containerRef = null,
	gradeTabs = null,
	infoText = '',
	selectedInfoText = '',
	paginationContent = null,
	headerContent = null,
	footerContent = null,
	renderTopContent = null,
	tableLabel = '',
	onRowClick = null,
	rowClassName = null,
	isRowSelected = null,
	expandedRowId = null,
	renderExpandedRow = null,
	persistExpandedRows = false,
	hideMainRowWhenExpanded = false,
	getExpandedRowClassName = null,
	getRowProps = null,
	striped = true,
	stickyHeader = true,
	className = '',
	tableClassName = '',
	wrapperClassName = '',
	headClassName = '',
	bodyClassName = '',
	rowKeyPrefix = 'table-row',
	isAllPagesSelected = false,
	visibleSelectedCount = 0,
	totalRowsOnPage = 0
}) {
	const warnedIndexFallbackRef = useRef(false);
	const warnedEmptyMessageUsageRef = useRef(false);
	const resolvedEmptyColSpan = columns.length || 1;
	const resolvedExpandedColSpan = columns.length || 1;
	const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
	const looksLikeDynamicStatusText =
		typeof emptyMessage === 'string' &&
		/(showing|found|across|matching|\d+\s*(student|teacher|record|item))/i.test(emptyMessage);

	if (isDev && rows.length > 0 && looksLikeDynamicStatusText && !warnedEmptyMessageUsageRef.current) {
		warnedEmptyMessageUsageRef.current = true;
		console.warn(
			'[Table] emptyMessage should be reserved for empty states only. ' +
			'Use infoText for dynamic status/count text when rows are present.'
		);
	}

	const renderGradeTabs = () => {
		if (!gradeTabs?.options?.length || !gradeTabs.onChange) {
			return null;
		}

		const {
			options,
			currentValue,
			onChange,
			showAll = false,
			allLabel = 'All',
			renderLabel = (option) => `Grade ${option}`,
			getOptionValue = (option) => option,
			buttonClassName = ''
		} = gradeTabs;

		return (
			<div className={styles.gradeTabs}>
				{showAll && (
					<button
						type="button"
						className={joinClassNames(
							styles.gradeTab,
							currentValue === 'all' && styles.gradeTabActive,
							buttonClassName
						)}
						onClick={() => onChange('all')}
					>
						{allLabel}
					</button>
				)}

				{options.map((option, index) => {
					const optionValue = getOptionValue(option, index);
					const isActive = currentValue === optionValue;

					return (
						<button
							key={`${optionValue}-${index}`}
							type="button"
							className={joinClassNames(
								styles.gradeTab,
								isActive && styles.gradeTabActive,
								buttonClassName
							)}
							onClick={() => onChange(optionValue)}
						>
							{renderLabel(option, index)}
						</button>
					);
				})}
			</div>
		);
	};

	const renderCellContent = (column, row, rowIndex) => {
		if (column.renderCell) {
			return column.renderCell({ row, rowIndex, column });
		}

		if (column.accessor) {
			return getValue(column.accessor, { row, rowIndex, column }) ?? '';
		}

		if (column.key) {
			return row?.[column.key] ?? '';
		}

		return '';
	};

	const renderHeaderCell = (column, columnIndex) => {
		if (column.renderHeader) {
			return column.renderHeader({ column, columnIndex });
		}

		return column.label ?? '';
	};

	const renderRows = () => {
		if (rows.length === 0) {
			return (
				<tr>
					<td colSpan={resolvedEmptyColSpan} className={styles.emptyState}>
						{emptyMessage}
					</td>
				</tr>
			);
		}

		return rows.map((row, rowIndex) => {
			const providedRowId = getRowId(row, rowIndex);
			const hasStableRowId = providedRowId !== undefined && providedRowId !== null && providedRowId !== '';
			const rowId = hasStableRowId ? providedRowId : rowIndex;

			if (!hasStableRowId && isDev && !warnedIndexFallbackRef.current) {
				warnedIndexFallbackRef.current = true;
				console.warn(
					`[Table] Missing stable row id. Falling back to row index for keys in "${tableLabel || rowKeyPrefix}". ` +
					'Provide a stable getRowId to avoid key instability during sorting/filtering.'
				);
			}

			const isExpanded = expandedRowId !== null && expandedRowId === rowId;
			const isSelected = Boolean(
				getValue(isRowSelected, {
					row,
					rowIndex,
					rowId,
					isExpanded
				})
			);
			const computedRowClassName = getValue(rowClassName, {
				row,
				rowIndex,
				rowId,
				isExpanded
			});
			const rowStripeClassName = striped ? (rowIndex % 2 === 0 ? styles.rowEven : styles.rowOdd) : '';
			const extraRowProps = getRowProps?.({ row, rowIndex, rowId, isExpanded }) || {};
			const mainRow = (
				<tr
					{...extraRowProps}
					className={joinClassNames(
						styles.row,
						rowStripeClassName,
						isSelected && styles.rowSelected,
						isExpanded && styles.rowExpanded,
						onRowClick && styles.rowClickable,
						computedRowClassName,
						extraRowProps.className
					)}
					onClick={onRowClick ? (event) => onRowClick({ row, rowIndex, rowId, event }) : extraRowProps.onClick}
				>
					{columns.map((column, columnIndex) => {
						const isIconColumn = ICON_COLUMN_KEYS.has(column?.key);
						const cellClassName = getValue(column.cellClassName, {
							row,
							rowIndex,
							column,
							columnIndex,
							rowId,
							isExpanded
						});
						const cellStyle = isIconColumn
							? { ...column.cellStyle, width: '56px', minWidth: '56px', maxWidth: '56px' }
							: column.cellStyle;

						return (
							<td
								key={column.key || `${rowId}-cell-${columnIndex}`}
								className={joinClassNames(styles.cell, isIconColumn && styles.iconColumnCell, cellClassName)}
								style={cellStyle}
							>
								{renderCellContent(column, row, rowIndex)}
							</td>
						);
					})}
				</tr>
			);

			const shouldRenderExpandedRow = renderExpandedRow && (persistExpandedRows || isExpanded);
			const expandedRow = shouldRenderExpandedRow ? (
				<tr
					className={joinClassNames(
						styles.expandedRow,
						getValue(getExpandedRowClassName, { row, rowIndex, rowId, isExpanded })
					)}
				>
					<td colSpan={resolvedExpandedColSpan} className={styles.expandedCell}>
						{renderExpandedRow({ row, rowIndex, rowId, isExpanded })}
					</td>
				</tr>
			) : null;

			return (
				<Fragment key={`${rowKeyPrefix}-${rowId}`}>
					{!(hideMainRowWhenExpanded && isExpanded) && mainRow}
					{expandedRow}
				</Fragment>
			);
		});
	};

	const getPaginationMargin = () => {
		// 1. All pages selected (all students across all pages)
		if (isAllPagesSelected) {
			return '204px';
		}
		// 2. Some rows selected (not all on page, not all pages)
		if (visibleSelectedCount > 0 && visibleSelectedCount < totalRowsOnPage) {
			return '302px';
		}
		// 3. All on current page selected (but not all pages)
		if (visibleSelectedCount === totalRowsOnPage && totalRowsOnPage > 0 && !isAllPagesSelected) {
			return '56px';
		}
		// 4. Nothing selected
		return '470px';
	};

	const hasRightContent = infoText || selectedInfoText || headerContent || paginationContent;

	return (
		<div className={joinClassNames(styles.container, className)} ref={containerRef}>
			{(renderTopContent || gradeTabs || hasRightContent) && (
				<div className={styles.topBar}>
					<div className={styles.topBarLeft}>
						{renderTopContent}
						{renderGradeTabs()}
					</div>

					{hasRightContent && (
						<div className={styles.topBarRight}>
							{infoText && <div className={styles.infoText}>{infoText}</div>}
							{selectedInfoText && <div className={styles.selectedInfoText}>{selectedInfoText}</div>}
							{headerContent}
							{paginationContent && (
								<div 
									className={styles.paginationWrapper}
									style={{ marginLeft: getPaginationMargin() }}
								>
									{paginationContent}
								</div>
							)}
						</div>
					)}
				</div>
			)}

			{loading ? (
				<div className={styles.stateMessage}>Loading...</div>
			) : error ? (
				<div className={joinClassNames(styles.stateMessage, styles.errorState)}>{error}</div>
			) : (
				<div className={joinClassNames(styles.tableWrapper, wrapperClassName)}>
					<table
						className={joinClassNames(styles.table, stickyHeader && styles.stickyHeader, tableClassName)}
						aria-label={tableLabel}
					>
						<thead className={joinClassNames(styles.head, headClassName)}>
							<tr>
								{columns.map((column, columnIndex) => {
									const headerClassName = getValue(column.headerClassName, { column, columnIndex });
									const isIconColumn = ICON_COLUMN_KEYS.has(column?.key);
									const shouldFixHeaderIconWidth = column?.key === 'select';
									const headerStyle = shouldFixHeaderIconWidth
										? {
											...(column.headerStyle || column.cellStyle),
											width: '56px',
											minWidth: '56px',
											maxWidth: '56px'
										}
										: (column.headerStyle || column.cellStyle);

									return (
										<th
											key={column.key || `header-${columnIndex}`}
											className={joinClassNames(styles.headerCell, shouldFixHeaderIconWidth && styles.iconColumnHeader, headerClassName)}
											style={headerStyle}
											scope="col"
										>
											{renderHeaderCell(column, columnIndex)}
										</th>
									);
								})}
							</tr>
						</thead>

						<tbody className={joinClassNames(styles.body, bodyClassName)}>{renderRows()}</tbody>
					</table>
				</div>
			)}

			{footerContent && <div className={styles.footer}>{footerContent}</div>}
		</div>
	);
}

export default Table;