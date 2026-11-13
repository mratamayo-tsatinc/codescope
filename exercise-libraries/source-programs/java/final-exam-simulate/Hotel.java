/*
@codescope
@title Simulate even and odd counting
@seed limit min=6 max=8
*/
public class Hotel
{
    public static void main(String[] args)
    {
        int i;
        int even = 0;
        int odd = 0;
        int limit = 7;
        for (i = 1; i <= limit; i++)
        {
            if (i % 2 == 0)
            {
                even++;
                System.out.println(i + " is even");
            }
            else
            {
                odd++;
                System.out.println(i + " is odd");
            }
        }
        System.out.println("Even = " + even);
        System.out.println("Odd = " + odd);
    }
}
