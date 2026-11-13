/*
@codescope
@title Trace a for loop with continue
@seed limit min=5 max=6
@seed skippedValue min=2 max=4
*/
public class Delta
{
    public static void main(String[] args)
    {
        int i;
        int sum = 0;
        int limit = 5;
        int skippedValue = 3;
        for (i = 1; i <= limit; i++)
        {
            if (i == skippedValue)
            {
                continue;
            }
            sum += i;
            System.out.println("sum = " + sum);
        }

        System.out.println("Final i: " + i);
    }
}
