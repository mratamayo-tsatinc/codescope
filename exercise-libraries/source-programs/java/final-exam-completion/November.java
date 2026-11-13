/*
@codescope
@title Complete a loop that skips multiples
*/
public class November
{
    public static void main(String[] args)
    {
        int i;
        int sum = 0;
        for (i = 1; i <= 8; i++)
        {
            if (i % 3 == 0)
            {
                continue;
            }
            sum += i;
            System.out.println("Added " + i);
        }
        System.out.println("Sum = " + sum);
    }
}
