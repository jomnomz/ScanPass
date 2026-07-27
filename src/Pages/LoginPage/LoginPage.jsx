import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Components/Authentication/AuthProvider/AuthProvider";
import styles from "./LoginPage.module.css";
import LoginForm from "../../Components/Forms/LoginForm/LoginForm";
import LoginSection from "../../Components/UI/Sections/LoginSection/LoginSection";
import stoninoschool from "../../assets/sto nino school.png";

const LoginPage = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && profile) {
      const timer = setTimeout(() => {
        if (profile.role === "admin") {
          navigate("/admin/dashboard");
        } else if (profile.role === "teacher") {
          navigate("/teacher/dashboard");
        } else {
          navigate("/");
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [loading, user, profile, navigate]);

  if (loading || (user && profile)) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className={styles.body}>

      <div className={styles.formContainer}>
        <LoginForm />
      </div>

      <div className={styles.loginShowCaseSectionContainer}>
        <LoginSection title='" Less time on attendance means more time learning. "' />
      </div>
    </div>
  );
};

export default LoginPage;