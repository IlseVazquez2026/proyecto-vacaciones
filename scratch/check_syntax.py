import jsbeautifier
import sys

def check_syntax(file_path):
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        # jsbeautifier doesn't check syntax, let's use a simpler approach
        # Check for unclosed braces or quotes
        stack = []
        mapping = {')': '(', '}': '{', ']': '['}
        line_num = 1
        col_num = 0
        in_string = False
        string_char = ''
        in_template = False
        
        i = 0
        while i < len(content):
            char = content[i]
            if char == '\n':
                line_num += 1
                col_num = 0
            else:
                col_num += 1
            
            if not in_string and not in_template:
                if char in ['"', "'"]:
                    in_string = True
                    string_char = char
                elif char == '`':
                    in_template = True
                elif char in '({[':
                    stack.append((char, line_num, col_num))
                elif char in ')}]':
                    if not stack:
                        print(f"Error: Unexpected {char} at line {line_num}, col {col_num}")
                        return
                    top, l, c = stack.pop()
                    if mapping[char] != top:
                        print(f"Error: Mismatched {char} at line {line_num}, col {col_num}. Expected match for {top} from line {l}, col {c}")
                        return
            elif in_string:
                if char == string_char and content[i-1] != '\\':
                    in_string = False
            elif in_template:
                if char == '`': # and content[i-1] != '\\': # templates can have escaped backticks but let's assume simple
                    in_template = False
                elif char == '$' and i+1 < len(content) and content[i+1] == '{':
                    # Recursive check for template insertion
                    # This is complex, let's just count { } inside templates
                    stack.append(('${', line_num, col_num))
                    i += 1
            i += 1
            
        if stack:
            top, l, c = stack.pop()
            print(f"Error: Unclosed {top} from line {l}, col {c}")
        else:
            print("No simple bracket/string errors found.")
            
    except Exception as e:
        print(f"Checker error: {e}")

if __name__ == "__main__":
    check_syntax(sys.argv[1])
