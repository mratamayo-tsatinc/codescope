/*
@codescope
@title Score Activity Calculation
@seed score min=80 max=85
@seed activities min=2 max=4
@seed bonus min=5 max=10 step=5
*/
public class TaskIndia
{
    public static void main(String[] args)
    {
        int score = 86, activities = 2, basePoints = 50;
        int bonus = 10, finalPoints;
        boolean qualified;

        finalPoints = basePoints + score / 10 * 2 - activities * 3;
        qualified = (score >= 75 && activities >= 2) || (score >= 90 && !((activities < 1)));

        if (qualified && score >= 85) {
            bonus = bonus + 10;
        } else if (!qualified || score < 60) {
            bonus = 0;
        }
        
        finalPoints = basePoints + bonus;

        System.out.println("=== ACTIVITY POINTS REPORT ===");
        System.out.println("Score        : " + score);
        System.out.println("Base Points  : " + basePoints);
        System.out.println("Bonus Points : " + bonus);
        System.out.println("Final Points : " + finalPoints);
        if (qualified) {
            System.out.println("Result       : QUALIFIED");
        } else {
            System.out.println("Result       : NOT QUALIFIED");
        }
    }
}
