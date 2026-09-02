    import styles from './DashboardCard.module.css'
    import minimalistic1__croped_stonino from '../../../../assets/minimalistic1__croped_stonino.png'

    function DashboardCard({ children, colors = {} }) {
        return (
            <div 
                className={styles.cardContainer} 
                style={{ backgroundColor: colors.bg }}
            >
                {children}
            </div>
        )
    }

    export default DashboardCard