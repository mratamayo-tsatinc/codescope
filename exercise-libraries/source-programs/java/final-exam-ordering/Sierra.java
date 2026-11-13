/*
@codescope
@title Order a for loop that stops early
@seed stopValue min=3 max=5
*/
public class Sierra
{
    public static void main(String[] args)
    {
        int i;
        int limit = 6;
        int stopValue = 4;
        for (i = 1; i <= limit; i++)
        {
            if (i == stopValue)
            {
                break;
            }
            System.out.println("i = " + i);
        }
        System.out.println("Stopped");
    }
}
