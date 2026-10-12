/*
 * @codescope
 * @title Personal Information Display
 * @bug id=bug-1 line=5 token=1 correct="char" wrong="Char" choices="Char|character"
 * @bug id=bug-2 line=6 token=1 correct="int" wrong="Int" choices="Int|integer"
 * @bug id=bug-3 line=7 token=5 correct="println" wrong="printLn" choices="printLn|printf"
 */
class PersonalInformationDisplay
{
    public static void main(String[] args)
    {
        char initial = 'J';
        int age = 21;
        System.out.println("Initial: " + initial);
        System.out.println("Age: " + age);
        System.out.println("Status: Active");
    }
}
