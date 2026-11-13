/*
@codescope
@title Trace a simple while loop
@seed limit min=3 max=4
*/
public class Alpha
{
    public static void main(String[] args)
    {
        int i = 1;
        int limit = 4;
        
        while (i <= limit)
        {
            System.out.println("Hello");
            i++;
        }

        System.out.println("World!!!");
    }
}
