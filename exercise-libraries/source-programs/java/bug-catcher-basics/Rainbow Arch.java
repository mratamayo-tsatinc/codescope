/*
 * @codescope
 * @title Rainbow Arch
 * @bug id=bug-1 line=5 token=1 correct="System" wrong="system" choices="system|SYSTEM"
 * @bug id=bug-2 line=6 token=5 correct="println" wrong="printLn" choices="printLn|printf"
 * @bug id=bug-3 line=8 token=5 correct="println" wrong="printLn" choices="printLn|printf"
 */
class RainbowArch
{
    public static void main(String[] args)
    {
        System.out.println("            Green");
        System.out.println("      Yellow     Brown");
        System.out.println("  Orange             Indigo");
        System.out.println("Red                      Violet");
    }
}
