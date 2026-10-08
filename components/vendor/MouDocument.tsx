// components/vendor/MouDocument.tsx
// Shows the vendor agreement text (markdown from GET /api/vendor/mou).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Theme } from '../../constants/theme';
import { parseMouMarkdown, type Inline } from '../../utils/mou-markdown';

function Runs({ runs }: { runs: Inline[] }) {
  return (
    <>
      {runs.map((run, index) => (
        <Text key={index} style={run.bold ? styles.bold : undefined}>
          {run.text}
        </Text>
      ))}
    </>
  );
}

export function MouDocument({ content }: { content: string }) {
  const blocks = parseMouMarkdown(content);

  return (
    <View>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <Text key={index} style={block.level === 1 ? styles.title : styles.heading}>
                <Runs runs={block.text} />
              </Text>
            );

          case 'paragraph':
            return (
              <Text key={index} style={styles.paragraph}>
                {block.lines.map((line, lineIndex) => (
                  <Text key={lineIndex}>
                    {lineIndex > 0 ? '\n' : ''}
                    <Runs runs={line} />
                  </Text>
                ))}
              </Text>
            );

          case 'list':
            return (
              <View key={index} style={styles.list}>
                {block.items.map((item, itemIndex) => (
                  <View key={itemIndex} style={styles.listItem}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.listText}>
                      <Runs runs={item} />
                    </Text>
                  </View>
                ))}
              </View>
            );

          case 'table':
            return (
              <View key={index} style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  {block.header.map((cell, cellIndex) => (
                    <Text key={cellIndex} style={[styles.tableCell, styles.bold]}>
                      {cell}
                    </Text>
                  ))}
                </View>
                {block.rows.map((row, rowIndex) => (
                  <View key={rowIndex} style={[styles.tableRow, rowIndex > 0 && styles.tableRowBorder]}>
                    {row.map((cell, cellIndex) => (
                      <Text key={cellIndex} style={styles.tableCell}>
                        {cell}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            );
        }
      })}
    </View>
  );
}

const body = { fontSize: Theme.font.sm, lineHeight: 21, color: Theme.colors.text } as const;

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  title: { fontSize: Theme.font.xl, fontWeight: '800', color: Theme.colors.text, marginBottom: Theme.spacing.md },
  heading: {
    fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text,
    marginTop: Theme.spacing.xl, marginBottom: Theme.spacing.sm,
  },
  paragraph: { ...body, marginBottom: Theme.spacing.md },

  list: { marginBottom: Theme.spacing.md, gap: Theme.spacing.sm },
  listItem: { flexDirection: 'row', gap: Theme.spacing.sm },
  bullet: { ...body, color: Theme.colors.textSecondary },
  listText: { ...body, flex: 1 },

  table: {
    borderWidth: 1, borderColor: Theme.colors.border, borderRadius: Theme.radius.md,
    marginBottom: Theme.spacing.md, overflow: 'hidden',
  },
  tableHeader: { backgroundColor: Theme.colors.surfaceSecondary },
  tableRow: { flexDirection: 'row' },
  tableRowBorder: { borderTopWidth: 1, borderTopColor: Theme.colors.borderLight },
  tableCell: { ...body, flex: 1, paddingVertical: Theme.spacing.sm, paddingHorizontal: Theme.spacing.md },
});
