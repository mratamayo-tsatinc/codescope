/*
@codescope
@title Simulate a running total with an early stop
@seed stopTotal min=8 max=15
*/
public class India
{
    public static void main(String[] args)
    {
        int n = 1;
        int total = 0;
        int limit = 10;
        int stopTotal = 10;
        while (n <= limit)
        {
            total += n;
            if (total > stopTotal)
            {
                break;
            }
            System.out.println("total = " + total);
            n++;
        }
        System.out.println("Stopped at n = " + n);
        System.out.println("Total = " + total);
    }
}
