import styles from "./Pagination.module.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

function getLayout(current, total) {
  if (total <= 3) {
    return { pages: Array.from({ length: total }, (_, i) => i + 1) };
  }

  const blockNumber = Math.floor((current - 1) / 3);
  const blockStart = blockNumber * 3 + 1;
  const blockEnd = Math.min(blockStart + 2, total);
  const totalBlocks = Math.ceil(total / 3);
  const isFirstBlock = blockNumber === 0;
  const isLastBlock = blockNumber === totalBlocks - 1;

  const pages = [];

  // Only last block gets "1 …" prefix
  if (isLastBlock && !isFirstBlock) {
    pages.push(1);
    pages.push("ellipsis-start");
  }

  for (let i = blockStart; i <= blockEnd; i++) pages.push(i);

  // First and middle blocks get "… last" suffix
  if (!isLastBlock) {
    pages.push("ellipsis-end");
    pages.push(total);
  }

  return { pages };
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
        <FontAwesomeIcon icon={faChevronLeft} />
      </button>

      {pages.map((page, index) => {
        if (page === "ellipsis-start" || page === "ellipsis-end" || page === "ellipsis") {
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
        <FontAwesomeIcon icon={faChevronRight} />
      </button>
    </nav>
  );
}

Pagination.defaultProps = {
  currentPage: 1,
  totalPages: 1,
  onPageChange: () => {},
};