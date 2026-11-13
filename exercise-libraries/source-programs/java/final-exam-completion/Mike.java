/*
@codescope
@title Complete a do while classification loop
*/
public class Mike
{
    public static void main(String[] args)
    {
        int n = 1;
        int big = 0;
        do
        {
            if (n > 3)
            {
                big++;
                System.out.println(n + " is big");
            }
            else
            {
                System.out.println(n + " is small");
            }
            n++;
        } while (n <= 6);
        System.out.println("Big count = " + big);
    }
}
