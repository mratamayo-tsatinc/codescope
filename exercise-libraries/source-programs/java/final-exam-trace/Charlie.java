/*
@codescope
@title Trace a do while running sum
@seed limit min=3 max=4
*/
public class Charlie
{
    public static void main(String[] args)
    {
        int i = 1;
        int sum = 0;
        int limit = 4;
        do
        {
            sum += i;
            System.out.println("sum = " + sum);
            i++;
        } while (i <= limit);
    }
}
