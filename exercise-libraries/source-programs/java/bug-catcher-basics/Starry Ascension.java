/*
 * @codescope
 * @title Starry Ascension
 * @bug id=bug-1 line=3 token=4 correct="main" wrong="Main" choices="Main|man"
 * @bug id=bug-2 line=5 token=5 correct="println" wrong="printLn" choices="printLn|printf"
 * @bug id=bug-3 line=7 token=5 correct="println" wrong="printLn" choices="printLn|printf"
 */
class StarryAscension
{
    public static void main(String[] args)
    {
        System.out.println("*");
        System.out.println("**");
        System.out.println("***");
        System.out.println("****");
        System.out.println("*****");
    }
}
