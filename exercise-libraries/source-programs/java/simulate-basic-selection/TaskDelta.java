/*
@codescope
@title Integer and If Else If
@seed score min=74 max=78
@seed bonus min=1 max=5
*/
public class TaskDelta
{
    public static void main(String[] args)
    {
        int score = 76;
        int grade;
        int bonus = 3;

        if (score >= 90) {
            grade = 1;
            bonus = bonus + 5;
        } else if (score >= 75) {
            grade = 2;
            bonus = bonus + 2;
        } else if (score >= 60) {
            grade = 3;
            bonus = bonus - 1;
        } else {
            grade = 4;
            bonus = 0;
        }

        score = score + bonus;

        System.out.println("score = " + score);
        System.out.println("grade = " + grade);
        System.out.println("bonus = " + bonus);
    }
}
