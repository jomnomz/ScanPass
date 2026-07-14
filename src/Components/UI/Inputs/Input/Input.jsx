import styles from './Input.module.css';
import SearchIcon from '@mui/icons-material/Search';

function Input({ 
  placeholder, 
  value, 
  onChange, 
  type = 'text',
  search = false, 
  ...props 
}) {
  return (
    <div className={styles.inputContainer}>
      {search && <SearchIcon className={styles.searchIcon} />}
      <input 
        className={`${styles.input} ${search ? styles.withIcon : ''}`}
        placeholder={placeholder} 
        type={type}
        value={value}
        onChange={onChange}
        {...props}
      />
    </div>
  );
}

export default Input;