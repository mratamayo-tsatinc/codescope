/*
@codescope
@title Trace a counting for loop
@seed limit min=4 max=5
*/
public class Bravo
{
    public static void main(String[] args)
    {
        int i;
        int limit = 5;
        for (i = 1; i <= limit; i++)
        {
            System.out.println("Count: " + i);
        }

        System.out.println("===END===");
    }
}
