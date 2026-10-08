/*
@codescope
@title Integer and Simple Switch 2
@seed option min=1 max=6
@seed points min=6 max=14
@seed value min=2 max=6
*/
public class TaskGolf
{
    public static void main(String[] args)
    {
        int option = 2;
        int points = 10;
        int value = 4;

        switch (option) {
            case 1:
                points = points + 5;
                break;

            case 2:
                points = points + value;

            case 3:
                points = points * 2;
                value = value + 1;
                break;

            case 4:
                points = points - 3;
                break;

            default:
                points = 0;
        }

        System.out.println("option = " + option);
        System.out.println("points = " + points);
        System.out.println("value = " + value);
    }
}
