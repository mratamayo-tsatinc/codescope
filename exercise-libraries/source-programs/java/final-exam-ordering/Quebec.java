/*
@codescope
@title Order a for loop with a running total
@seed limit min=3 max=5
*/
public class Quebec
{
    public static void main(String[] args)
    {
        int i;
        int sum = 0;
        int limit = 4;
        for (i = 1; i <= limit; i++)
        {
            sum += i;
            System.out.println("sum = " + sum);
        }
        System.out.println("Total = " + sum);
    }
}
