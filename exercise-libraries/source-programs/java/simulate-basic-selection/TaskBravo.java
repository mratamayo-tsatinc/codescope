/*
@codescope
@title Integer and If Else
@seed x min=10 max=14
@seed y min=5 max=9
@seed bonus min=2 max=6
*/
public class TaskBravo
{
    public static void main(String[] args)
    {
        int x = 12;
        int y = 7;
        int result;
        int bonus = 4;

        result = x - y * 2;

        if (result > 5)
        {
            result = result + bonus;
            bonus = bonus + 2;
        }
        else
        {
            result = result + 10;
            bonus = bonus - 1;
        }

        System.out.println("x = " + x);
        System.out.println("y = " + y);
        System.out.println("result = " + result);
        System.out.println("bonus = " + bonus);
    }
}