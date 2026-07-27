import styles from "./LoginSection.module.css";
import laptop from "../../../../assets/laptop.png";

const LoginSection = ({
  title = "Less time on attendance means more time learning",
}) => {
  return (
    <div className={styles.section}>
      <div className={styles.overlayContent}>
        <h1 className={styles.title}>{title}</h1>
      </div>

      <div className={styles.laptopWrapper}>
        <img src={laptop} alt="" className={styles.laptopImage} />
      </div>
    </div>
  );
};

export default LoginSection;