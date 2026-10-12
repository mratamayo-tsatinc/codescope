/*
 * @codescope
 * @title Cube Volume Finder
 * @bug id=bug-1 line=5 token=1 correct="int" wrong="Int" choices="Int|integer"
 * @bug id=bug-2 line=6 token=4 correct="side" wrong="Side" choices="Side|sides"
 * @bug id=bug-3 line=7 token=5 correct="println" wrong="printLn" choices="printLn|printf"
 */
class CubeVolumeFinder
{
    public static void main(String[] args)
    {
        int side = 4;
        int volume = side * side * side;
        System.out.println("Volume: " + volume);
    }
}
