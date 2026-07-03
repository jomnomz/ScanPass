import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { apiClient } from "../../../config/api"; 
import styles from "./LoginForm.module.css";
import Button from "../../UI/Buttons/Button/Button";
import stonino from "../../../assets/sto nino.png";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import ReportGmailerrorredIcon from '@mui/icons-material/ReportGmailerrorred';
import minimalistic1_stonino from "../../../assets/minimalistic1_stonino.png";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!email.includes('@')) {
        setError("Please enter a valid email address");
        setLoading(false);
        return;
      }

      console.log(`🔐 Attempting login for: ${email}`);

      let loginResult = null;
      try {
        // Use apiClient instead of fetch
        const response = await apiClient.post('/api/teacher-invite/teacher-login', {
          email,
          password
        });
        
        loginResult = response.data;
        
        if (loginResult.success) {
          console.log('✅ Teacher login successful');
          
          if (loginResult.session) {
            await supabase.auth.setSession({
              access_token: loginResult.session.access_token,
              refresh_token: loginResult.session.refresh_token,
            });
          }
          
          setTimeout(() => {
            if (loginResult.user?.role === "admin") {
              navigate("/admin/dashboard");
            } else if (loginResult.user?.role === "teacher") {
              navigate("/teacher/dashboard");
            } else {
              navigate("/");
            }
          }, 500);
          
          setLoading(false);
          return;
        }
        
        if (loginResult.error && loginResult.error.includes('deactivated')) {
          setError("This account has been deactivated. Please contact admin.");
          setLoading(false);
          return;
        }
        
      } catch (teacherLoginError) {
        console.log('⚠️ Teacher login endpoint failed, trying regular login');
        // If the teacher login endpoint fails, we'll try regular login
      }

      console.log('🔄 Trying regular login');
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        console.error('❌ Authentication failed:', authError.message);
        setError("Invalid email or password");
        setLoading(false);
        return;
      }

      console.log('✅ Regular login successful');

      const { data: userData, error: profileError } = await supabase
        .from("users")
        .select("role, status")
        .eq("user_id", authData.user.id)
        .single();

      if (profileError || !userData) {
        console.error('❌ User profile not found');
        setError("User profile not found");
        setLoading(false);
        return;
      }

      if (userData.status === "inactive") {
        setError("This account has been deactivated. Please contact admin.");
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }
      
      if (userData.status === "pending") {
        console.log('⚠️ Account is still pending - trying to auto-activate');
        try {
          // Use apiClient for auto-activation retry
          const activateResponse = await apiClient.post('/api/teacher-invite/teacher-login', {
            email,
            password
          });
          
          const activateResult = activateResponse.data;
          
          if (activateResult.success) {
            console.log('✅ Auto-activated successfully on retry');
            if (activateResult.session) {
              await supabase.auth.setSession({
                access_token: activateResult.session.access_token,
                refresh_token: activateResult.session.refresh_token,
              });
            }
          }
        } catch (retryError) {
          console.error('❌ Auto-activation retry failed:', retryError);
        }
      }

      setTimeout(() => {
        if (userData.role === "admin") {
          navigate("/admin/dashboard");
        } else if (userData.role === "teacher") {
          navigate("/teacher/dashboard");
        } else {
          navigate("/");
        }
      }, 500);

    } catch (err) {
      console.error('❌ Login error:', err);
      
      // Better error handling with axios errors
      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        if (err.response.status === 404) {
          setError("Service unavailable. Please try again later.");
        } else if (err.response.status === 401) {
          setError("Invalid email or password");
        } else if (err.response.data?.error) {
          setError(err.response.data.error);
        } else {
          setError("Something went wrong. Please try again.");
        }
      } else if (err.request) {
        // The request was made but no response was received
        setError("Cannot connect to server. Please check your connection.");
      } else {
        // Something happened in setting up the request that triggered an Error
        setError("Something went wrong. Please try again.");
      }
      
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleLogin}>
      <div className={styles.top}>
          <div className={styles.logo}>
          <img src={minimalistic1_stonino} alt="minimalist1_stonino" />
        </div>
        <div><p>Sign in</p></div>
      </div>

      <div className={styles.inputWrapper}>
        <input
          className={styles.input}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className={styles.inputWrapper}>
        <div className={styles.passwordContainer}>
          <input
            className={styles.input}
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className={styles.eyeButton}
            onClick={() => setShowPassword(!showPassword)}
          >
            <FontAwesomeIcon 
              icon={showPassword ? faEyeSlash : faEye} 
              style={{ fontSize: '13px' }}
            />
          </button>
        </div>
      </div>

      <div className={styles.inputWrapper}>
        <Button
          label={loading ? "Logging in..." : "Login"}
          color="nav"
          width="full"
          type="submit"
          disabled={loading}
        />
      </div>

      {error && <div className={styles.error}><ReportGmailerrorredIcon/> {error}</div>}
      
    </form>
  );
}

export default LoginForm;