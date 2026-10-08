/*
@codescope
@title Integer and If Else with nested if Else
@seed age min=17 max=21
@seed score min=80 max=84
@seed points min=3 max=7
*/
public class TaskEcho
{
    public static void main(String[] args)
    {
        int age = 19;
        int score = 82;
        int points = 5;
        int status = 0;

        if (age >= 18) {
            points = points + 5;

            if (score >= 80) {
                points = points + 10;
                status = 1;
            } else {
                points = points + 2;
                status = 2;
            }
        } else {
            points = points - 1;
            status = 3;
        }

        System.out.println("age = " + age);
        System.out.println("score = " + score);
        System.out.println("points = " + points);
        System.out.println("status = " + status);
    }
}
