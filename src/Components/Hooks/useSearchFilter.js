import { useState, useMemo } from 'react';

/**
 * Generic search/filter hook for tables and lists.
 *
 * @param {Array} rows - The full, unfiltered array of row objects.
 * @param {Array<string|Function>} searchFields - Fields to match against.
 *   Pass a string key to read row[key] directly (e.g. 'name', 'lrn'),
 *   or a function (row) => value for computed/nested fields
 *   (e.g. row => `${row.first_name} ${row.last_name}`).
 *
 * @returns {{
 *   searchTerm: string,
 *   setSearchTerm: Function,
 *   filteredRows: Array
 * }}
 *
 * Usage:
 *   const { searchTerm, setSearchTerm, filteredRows } = useSearchFilter(
 *     attendanceRows,
 *     ['name', 'lrn']
 *   );
 *
 *   // with a computed field:
 *   const { searchTerm, setSearchTerm, filteredRows } = useSearchFilter(
 *     students,
 *     [row => `${row.first_name} ${row.last_name}`, 'lrn']
 *   );
 */
function useSearchFilter(rows = [], searchFields = []) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
      return rows;
    }

    if (searchFields.length === 0) {
      return rows;
    }

    return rows.filter((row) =>
      searchFields.some((field) => {
        const value = typeof field === 'function' ? field(row) : row?.[field];
        return value?.toString().toLowerCase().includes(term);
      })
    );
  }, [rows, searchTerm, searchFields]);

  return { searchTerm, setSearchTerm, filteredRows };
}

export default useSearchFilter;