/*
@codescope
@title Simulate a while loop running total
@seed limit min=4 max=5
*/
public class Foxtrot
{
    public static void main(String[] args)
    {
        int n = 1;
        int total = 0;
        int limit = 5;
        while (n <= limit)
        {
            total += n;
            System.out.println("n = " + n + " total = " + total);
            n++;
        }
        System.out.println("Final total = " + total);
    }
}
