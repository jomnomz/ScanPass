import styles from "./Pagination.module.css";

function getLayout(current, total) {
  if (total <= 3) {
    // If total pages is 3 or less, show all
    return {
      pages: Array.from({ length: total }, (_, i) => i + 1)
    };
  }

  // Calculate which block of 3 we're in
  // Pages 1-3: block 1, Pages 4-6: block 2, Pages 7-9: block 3, etc.
  const blockNumber = Math.floor((current - 1) / 3);
  const blockStart = blockNumber * 3 + 1;
  const blockEnd = Math.min(blockStart + 2, total);
  
  const pages = [];
  
  // Add the 3 pages from the current block
  for (let i = blockStart; i <= blockEnd; i++) {
    pages.push(i);
  }
  
  // If there are more pages after the block, add ellipsis and last page
  if (blockEnd < total) {
    pages.push("ellipsis");
    pages.push(total);
  }
  
  return {
    pages: pages
  };
}

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  const { pages } = getLayout(currentPage, totalPages);

  function go(page) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange(page);
  }

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <button
        className={styles.btn}
        onClick={() => go(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        &#8249;
      </button>

      {pages.map((page, index) => {
        if (page === "ellipsis") {
          return (
            <span key={`ellipsis-${index}`} className={styles.ellipsis} aria-hidden="true">
              &hellip;
            </span>
          );
        }
        
        return (
          <button
            key={page}
            className={`${styles.btn} ${currentPage === page ? styles.active : ""}`}
            onClick={() => go(page)}
            aria-current={currentPage === page ? "page" : undefined}
          >
            {page}
          </button>
        );
      })}

      <button
        className={styles.btn}
        onClick={() => go(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        &#8250;
      </button>
    </nav>
  );
}

Pagination.defaultProps = {
  currentPage: 1,
  totalPages: 1,
  onPageChange: () => {},
};