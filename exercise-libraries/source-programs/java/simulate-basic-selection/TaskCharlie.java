/*
@codescope
@title Integer and Multiple Simple Ifs
@seed score min=50 max=80
@seed points min=8 max=12
@seed level min=1 max=4
*/
public class TaskCharlie
{
    public static void main(String[] args)
    {
        int score = 68;
        int points = 10;
        int level = 2;

        if (score >= 60) {
            points = points + 5;
        }

        if (score >= 70) {
            points = points + 10;
            level = level + 1;
        }

        if (points > 12) {
            score = score + 4;
        }

        System.out.println("score = " + score);
        System.out.println("points = " + points);
        System.out.println("level = " + level);
    }
}