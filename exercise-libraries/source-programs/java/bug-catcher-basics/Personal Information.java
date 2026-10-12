/*
 * @codescope
 * @title Personal Information
 * @bug id=bug-1 line=5 token=1 correct="String" wrong="string" choices="string|char"
 * @bug id=bug-2 line=6 token=1 correct="int" wrong="Int" choices="Int|integer"
 * @bug id=bug-3 line=8 token=5 correct="println" wrong="printLn" choices="printLn|printf"
 * @bug id=bug-4 line=10 token=9 correct="city" wrong="City" choices="City|town"
 */
class PersonalInformation
{
    public static void main(String[] args)
    {
        String name = "Jordan";
        int age = 21;
        String city = "Tarlac";
        System.out.println("Name: " + name);
        System.out.println("Age: " + age);
        System.out.println("City: " + city);
    }
}
