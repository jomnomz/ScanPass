import { useSearchParams } from 'react-router-dom';
import styles from './TeacherStudents.module.css';
import SectionLabel from "../../../Components/UI/Labels/SectionLabel/SectionLabel.jsx";
import TeacherStudentViewTable from '../../../Components/Tables/TeacherStudentViewTable/TeacherStudentViewTable.jsx';

function TeacherStudents() {
  const [searchParams] = useSearchParams();
  const selectedClass = searchParams.get('class') || '';
  const gradeId = searchParams.get('gradeId');
  const sectionId = searchParams.get('sectionId');

  return (
    <main className={styles.main}>
      <SectionLabel label="Student Record" />
      <TeacherStudentViewTable selectedClass={selectedClass} gradeId={gradeId} sectionId={sectionId} />
    </main>
  );
}

export default TeacherStudents;